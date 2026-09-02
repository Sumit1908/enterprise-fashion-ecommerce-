import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { PINCODE_FALLBACK } from './pincode.data.js';
import { isPlausibleStreetAddress, normaliseText } from './address-check.js';

const env = loadEnv();

/** Free-delivery promise is 3–7 business days everywhere we ship. */
const DEFAULT_ETA = { min: 3, max: 7 };
const MEM_TTL_MS = 60 * 60 * 1000; // in-process cache for hot repeat lookups

export interface ResolvedPincode {
  pincode: string;
  city: string;
  district: string;
  state: string;
  /** Representative post-office / locality name — informational only. */
  area: string | null;
  serviceable: boolean;
  codAvailable: boolean;
  etaMinDays: number;
  etaMaxDays: number;
  source: 'cache' | 'indiapost' | 'fallback';
}

interface RawRecord {
  city: string;
  district: string;
  state: string;
  area: string | null;
}

/** State-name variants seen in postal data vs. what a form might submit. */
const STATE_ALIASES: Record<string, string> = {
  'nct of delhi': 'delhi',
  'national capital territory of delhi': 'delhi',
  orissa: 'odisha',
  pondicherry: 'puducherry',
  uttaranchal: 'uttarakhand',
  'jammu & kashmir': 'jammu and kashmir',
  'jammu and kashmir': 'jammu and kashmir',
  'dadra & nagar haveli': 'dadra and nagar haveli and daman and diu',
  'daman & diu': 'dadra and nagar haveli and daman and diu',
  'andaman & nicobar islands': 'andaman and nicobar islands',
};

function canonicalState(value: string): string {
  const n = normaliseText(value).replace(/\band\b/g, '&').replace(/\s+/g, ' ').trim();
  const plain = normaliseText(value);
  return STATE_ALIASES[plain] ?? STATE_ALIASES[n] ?? plain;
}

function canonicalCity(value: string): string {
  return normaliseText(value)
    .replace(/\bdistrict\b/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class PincodeService {
  private readonly logger = new Logger(PincodeService.name);
  private readonly mem = new Map<string, { at: number; value: ResolvedPincode | null }>();

  constructor(private readonly prisma: PrismaService) {}

  /** Format check only — cheap and side-effect free. */
  static isWellFormed(pincode: string): boolean {
    return /^[1-9][0-9]{5}$/.test(String(pincode ?? '').trim());
  }

  /**
   * Resolve a PIN to its authoritative city/district/state + serviceability.
   * Returns `null` when the PIN provably does not exist.
   * Throws {@link ServiceUnavailableException} when the upstream lookup is
   * unreachable and nothing is cached — callers must NOT treat that as valid.
   */
  async resolve(rawPin: string): Promise<ResolvedPincode | null> {
    const pin = String(rawPin ?? '').trim();
    if (!PincodeService.isWellFormed(pin)) return null;

    const cached = this.mem.get(pin);
    if (cached && Date.now() - cached.at < MEM_TTL_MS) return cached.value;

    const row = await this.prisma.serviceablePincode
      .findUnique({ where: { pincode: pin } })
      .catch(() => null);

    const ttlMs = env.PINCODE_CACHE_TTL_DAYS * 86_400_000;
    const rowUsable = !!row && !!row.city && !!row.state;
    const rowFresh =
      rowUsable &&
      (row!.source === 'manual' ||
        (!!row!.verifiedAt && Date.now() - row!.verifiedAt.getTime() < ttlMs));

    if (rowUsable && rowFresh) {
      return this.remember(
        pin,
        this.build(pin, rowToRecord(row!), row, 'cache'),
      );
    }

    let fetched: RawRecord | null = null;
    let upstreamFailed = false;
    try {
      fetched = await this.fetchFromIndiaPost(pin);
    } catch (err) {
      upstreamFailed = true;
      this.logger.warn(
        `PIN lookup failed for ${pin}: ${(err as Error).message ?? err}`,
      );
    }

    if (fetched) {
      await this.upsertCache(pin, fetched);
      return this.remember(pin, this.build(pin, fetched, row, 'indiapost'));
    }

    if (!upstreamFailed) {
      // Upstream answered definitively: no such PIN. A stale cache row still
      // proves the PIN is real, so honour it; otherwise it is invalid.
      if (rowUsable) {
        return this.remember(pin, this.build(pin, rowToRecord(row!), row, 'cache'));
      }
      return this.remember(pin, null);
    }

    // Upstream unreachable — fall back to any cache row, then the offline map.
    if (rowUsable) {
      return this.build(pin, rowToRecord(row!), row, 'cache');
    }
    const fb = PINCODE_FALLBACK[pin];
    if (fb) return this.build(pin, { ...fb, area: null }, row, 'fallback');

    throw new ServiceUnavailableException(
      'Unable to verify PIN code. Please try again.',
    );
  }

  /**
   * Order-time gate. Validates the street address quality, resolves the PIN
   * server-side, enforces serviceability, and checks that the submitted
   * city/state actually belong to that PIN. Never trusts the client values.
   */
  async assertDeliverableAddress(addr: {
    line1: string;
    pincode: string;
    city: string;
    state: string;
  }): Promise<ResolvedPincode> {
    if (!isPlausibleStreetAddress(addr.line1)) {
      throw new BadRequestException(
        'Please enter your full street address (house / building number, street and area).',
      );
    }

    let resolved: ResolvedPincode | null;
    try {
      resolved = await this.resolve(addr.pincode);
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw new BadRequestException(
          'We could not verify your PIN code just now. Please try again in a moment.',
        );
      }
      throw err;
    }

    if (!resolved) {
      throw new BadRequestException('Please enter a valid PIN code.');
    }
    if (!resolved.serviceable) {
      throw new BadRequestException(
        'Sorry, delivery is currently unavailable at this PIN code.',
      );
    }

    const submittedCity = canonicalCity(addr.city ?? '');
    const submittedState = canonicalState(addr.state ?? '');
    const cityOk =
      !!submittedCity &&
      [resolved.city, resolved.district]
        .map(canonicalCity)
        .some((c) => c.length > 0 && c === submittedCity);
    const stateOk =
      !!submittedState && canonicalState(resolved.state) === submittedState;

    if (!cityOk || !stateOk) {
      throw new BadRequestException(
        'The city/state does not match the PIN code.',
      );
    }

    return resolved;
  }

  /* --------------------------------------------------------------- internals */

  private build(
    pin: string,
    info: RawRecord,
    row: { prepaidAvailable: boolean; codAvailable: boolean; etaMinDays: number | null; etaMaxDays: number | null } | null,
    source: ResolvedPincode['source'],
  ): ResolvedPincode {
    return {
      pincode: pin,
      city: info.city,
      district: info.district || info.city,
      state: info.state,
      area: info.area ?? null,
      serviceable: row ? row.prepaidAvailable : true,
      codAvailable: row ? row.codAvailable : true,
      etaMinDays: row?.etaMinDays ?? DEFAULT_ETA.min,
      etaMaxDays: row?.etaMaxDays ?? DEFAULT_ETA.max,
      source,
    };
  }

  private remember(pin: string, value: ResolvedPincode | null): ResolvedPincode | null {
    this.mem.set(pin, { at: Date.now(), value });
    return value;
  }

  private async fetchFromIndiaPost(pin: string): Promise<RawRecord | null> {
    if (env.PINCODE_PROVIDER === 'none') {
      const fb = PINCODE_FALLBACK[pin];
      return fb ? { ...fb, area: null } : null;
    }

    const url = `${env.PINCODE_API_BASE_URL.replace(/\/$/, '')}/pincode/${pin}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(env.PINCODE_LOOKUP_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`upstream responded ${res.status}`);

    const body: unknown = await res.json();
    const entry = Array.isArray(body) ? (body[0] as Record<string, unknown>) : null;
    const offices = entry?.PostOffice;
    if (
      !entry ||
      entry.Status !== 'Success' ||
      !Array.isArray(offices) ||
      offices.length === 0
    ) {
      return null;
    }

    const list = offices as Array<Record<string, string | null>>;
    const primary =
      list.find((o) => /head/i.test(o.BranchType ?? '')) ??
      list.find((o) => (o.DeliveryStatus ?? '').toLowerCase() === 'delivery') ??
      list[0];
    if (!primary) return null;

    const state = (primary.State ?? '').trim();
    const district = (primary.District ?? '').trim();
    if (!state || !district) return null;

    return {
      city: district,
      district,
      state,
      area: (primary.Name ?? '').trim() || null,
    };
  }

  private async upsertCache(pin: string, info: RawRecord): Promise<void> {
    const data = {
      city: info.city,
      district: info.district,
      state: info.state,
      source: 'indiapost',
      verifiedAt: new Date(),
    };
    await this.prisma.serviceablePincode
      .upsert({
        where: { pincode: pin },
        // create fresh; leave curated serviceability flags untouched on update
        create: { pincode: pin, ...data },
        update: data,
      })
      .catch((e: unknown) =>
        this.logger.warn(
          `PIN cache write failed for ${pin}: ${(e as Error).message ?? e}`,
        ),
      );
  }
}

function rowToRecord(row: {
  city: string | null;
  district: string | null;
  state: string | null;
}): RawRecord {
  return {
    city: row.city ?? '',
    district: row.district ?? row.city ?? '',
    state: row.state ?? '',
    area: null,
  };
}
