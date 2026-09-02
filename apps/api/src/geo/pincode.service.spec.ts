import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(32);
process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/db';
process.env.PINCODE_PROVIDER = 'indiapost';

let PincodeService: typeof import('./pincode.service.js').PincodeService;

beforeAll(async () => {
  ({ PincodeService } = await import('./pincode.service.js'));
});

interface FakeRow {
  pincode: string;
  city: string | null;
  district: string | null;
  state: string | null;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  source: string;
  verifiedAt: Date | null;
}

function makePrisma(row: FakeRow | null = null) {
  return {
    serviceablePincode: {
      findUnique: vi.fn().mockResolvedValue(row),
      upsert: vi.fn().mockResolvedValue(row),
    },
  };
}

function indiaPostOk(district = 'Central Delhi', state = 'Delhi') {
  return {
    ok: true,
    status: 200,
    json: async () => [
      {
        Message: 'Number of pincode(s) found:1',
        Status: 'Success',
        PostOffice: [
          {
            Name: 'Connaught Place',
            BranchType: 'Sub Post Office',
            DeliveryStatus: 'Non-Delivery',
            District: district,
            State: state,
            Pincode: '110001',
          },
        ],
      },
    ],
  } as unknown as Response;
}

const svc = (prisma: ReturnType<typeof makePrisma>) =>
  new PincodeService(prisma as never);

afterEach(() => vi.restoreAllMocks());
beforeEach(() => vi.restoreAllMocks());

describe('PincodeService.resolve', () => {
  it('rejects a malformed PIN without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const prisma = makePrisma();
    expect(await svc(prisma).resolve('12ab')).toBeNull();
    expect(await svc(prisma).resolve('012345')).toBeNull();
    expect(await svc(prisma).resolve('99999')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves a real PIN from India Post and caches it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(indiaPostOk());
    const prisma = makePrisma();
    const s = svc(prisma);
    const r = await s.resolve('110001');
    expect(r).toMatchObject({
      pincode: '110001',
      city: 'Central Delhi',
      district: 'Central Delhi',
      state: 'Delhi',
      serviceable: true,
      source: 'indiapost',
    });
    expect(prisma.serviceablePincode.upsert).toHaveBeenCalledOnce();
    // second lookup is served from memory — no extra fetch
    await s.resolve('110001');
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('returns null when India Post has no record for the PIN', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ Message: 'No records found', Status: 'Error', PostOffice: null }],
    } as unknown as Response);
    expect(await svc(makePrisma()).resolve('999999')).toBeNull();
  });

  it('serves a fresh manual cache row without hitting the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const prisma = makePrisma({
      pincode: '560001',
      city: 'Bengaluru',
      district: 'Bengaluru',
      state: 'Karnataka',
      codAvailable: true,
      prepaidAvailable: true,
      etaMinDays: null,
      etaMaxDays: null,
      source: 'manual',
      verifiedAt: null,
    });
    const r = await svc(prisma).resolve('560001');
    expect(r).toMatchObject({ city: 'Bengaluru', state: 'Karnataka', source: 'cache' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the offline map when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));
    const r = await svc(makePrisma()).resolve('110001');
    expect(r).toMatchObject({ city: 'New Delhi', state: 'Delhi', source: 'fallback' });
  });

  it('throws (retry) when the API is unreachable and nothing is cached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    await expect(svc(makePrisma()).resolve('641001')).rejects.toThrow(/try again/i);
  });
});

describe('PincodeService.assertDeliverableAddress', () => {
  const base = {
    line1: 'House No. 42, Sector 15, Main Road',
    pincode: '110001',
    city: 'Central Delhi',
    state: 'Delhi',
  };

  it('passes when the street address, PIN, city and state all line up', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(indiaPostOk());
    const r = await svc(makePrisma()).assertDeliverableAddress(base);
    expect(r).toMatchObject({ city: 'Central Delhi', state: 'Delhi' });
  });

  it('rejects a manipulated city', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(indiaPostOk());
    await expect(
      svc(makePrisma()).assertDeliverableAddress({ ...base, city: 'Mumbai' }),
    ).rejects.toThrow('The city/state does not match the PIN code.');
  });

  it('rejects a manipulated state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(indiaPostOk());
    await expect(
      svc(makePrisma()).assertDeliverableAddress({ ...base, state: 'Maharashtra' }),
    ).rejects.toThrow('The city/state does not match the PIN code.');
  });

  it('rejects a non-existent PIN', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ Status: 'Error', PostOffice: null }],
    } as unknown as Response);
    await expect(
      svc(makePrisma()).assertDeliverableAddress({ ...base, pincode: '999999' }),
    ).rejects.toThrow('Please enter a valid PIN code.');
  });

  it('rejects a valid but non-serviceable PIN', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(indiaPostOk());
    const prisma = makePrisma({
      pincode: '110001',
      city: 'Central Delhi',
      district: 'Central Delhi',
      state: 'Delhi',
      codAvailable: false,
      prepaidAvailable: false,
      etaMinDays: null,
      etaMaxDays: null,
      source: 'manual',
      verifiedAt: null,
    });
    await expect(
      svc(prisma).assertDeliverableAddress(base),
    ).rejects.toThrow('Sorry, delivery is currently unavailable at this PIN code.');
  });

  it('refuses the address (asks for retry) when the lookup is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ENOTFOUND'));
    await expect(
      svc(makePrisma()).assertDeliverableAddress({ ...base, pincode: '641001', city: 'Coimbatore', state: 'Tamil Nadu' }),
    ).rejects.toThrow(/try again/i);
  });

  it('rejects a junk street address before touching the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(
      svc(makePrisma()).assertDeliverableAddress({ ...base, line1: 'asdf' }),
    ).rejects.toThrow(/full street address/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
