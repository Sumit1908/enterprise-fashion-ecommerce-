import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { loadEnv } from '@slay/config';

const env = loadEnv();
const API_URL = 'https://api.anthropic.com/v1/messages';
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Fields the model may propose. Everything here is advisory only. */
export interface ProductSuggestion {
  name?: string;
  brand?: string;
  gender?: 'MEN' | 'WOMEN' | 'UNISEX' | 'BOYS' | 'GIRLS' | 'BABY';
  colour?: string;
  category?: string;
  shortDescription?: string;
  description?: string;
  tags?: string[];
  material?: string;
  style?: string;
  notes?: string;
}

const SYSTEM_PROMPT = `You are a fashion-catalogue assistant for an Indian apparel store.
You are given ONE product photo. Propose catalogue attributes that a human editor will review.

Return ONLY a JSON object (no markdown, no prose) with these optional keys:
  name              short retail product title (e.g. "Relaxed-Fit Cotton Oxford Shirt")
  brand             ONLY if a logo / wordmark is clearly legible in the image, else omit
  gender            one of: MEN, WOMEN, UNISEX, BOYS, GIRLS, BABY
  colour            the dominant colour in plain words (e.g. "Olive green")
  category          a broad category such as Shirts, T-Shirts, Jeans, Dresses, Jackets, Shoes, Accessories
  shortDescription  one marketing sentence (<= 140 chars)
  description       2-4 sentence description of the visible garment
  tags              3-8 lowercase keyword tags
  material          ONLY if the fabric is clearly identifiable by sight (e.g. denim, knit, leather), else omit
  style             e.g. casual, formal, streetwear, ethnic, athleisure
  notes             one short line on anything uncertain

RULES:
- These are SUGGESTIONS for human review. If unsure about a field, omit it.
- NEVER invent MRP, price, SKU, stock, model number, exact fabric composition/percentages,
  care instructions, country of origin, warranty, or size. Omit anything you cannot see.
- Do not describe people; describe the garment/product only.
- Keep all text brand-neutral and free of unverifiable claims.`;

@Injectable()
export class AiSuggestService {
  private readonly logger = new Logger(AiSuggestService.name);

  get available(): boolean {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  async suggestFromImageUrl(imageUrl: string): Promise<{
    suggestions: ProductSuggestion;
    disclaimer: string;
  }> {
    if (!this.available) {
      throw new ServiceUnavailableException('AI suggestions are not configured on this server');
    }
    if (!/^https?:\/\/\S+$/i.test(imageUrl)) {
      throw new BadRequestException('A valid image URL is required');
    }

    // Fetch the image server-side (never trust a client-supplied base64 blob).
    let imgRes: Response;
    try {
      imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new BadRequestException('Could not download that image');
    }
    if (!imgRes.ok) throw new BadRequestException(`Image fetch failed (${imgRes.status})`);
    const mime = (imgRes.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!IMAGE_MIME.has(mime)) {
      throw new BadRequestException(`Unsupported image type "${mime || 'unknown'}"`);
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength > IMAGE_MAX_BYTES) {
      throw new BadRequestException('Image is too large to analyse (max 10 MB)');
    }

    let aiRes: Response;
    try {
      aiRes = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: env.AI_SUGGEST_MODEL,
          max_tokens: 700,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } },
                { type: 'text', text: 'Analyse this product photo and return the JSON described.' },
              ],
            },
          ],
        }),
      });
    } catch (err) {
      this.logger.error(`Anthropic request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('The AI service is unavailable right now. Please try again.');
    }

    const body = (await aiRes.json().catch(() => ({}))) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string };
    };
    if (!aiRes.ok) {
      this.logger.warn(`Anthropic ${aiRes.status}: ${body.error?.message ?? 'no detail'}`);
      throw new ServiceUnavailableException('The AI service returned an error. Please try again.');
    }

    const text = body.content?.find((c) => c.type === 'text')?.text ?? '';
    const suggestions = parseSuggestion(text);

    return {
      suggestions,
      disclaimer:
        'AI-generated suggestions from the product image. Review every field before saving. ' +
        'Price, SKU, stock, exact materials and other specs are never AI-generated.',
    };
  }
}

const GENDERS = new Set(['MEN', 'WOMEN', 'UNISEX', 'BOYS', 'GIRLS', 'BABY']);

function parseSuggestion(raw: string): ProductSuggestion {
  const jsonSlice = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(jsonSlice) as Record<string, unknown>;
  } catch {
    return {};
  }
  const str = (v: unknown, max = 2000): string | undefined => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s.slice(0, max) : undefined;
  };
  const out: ProductSuggestion = {
    name: str(obj.name, 140),
    brand: str(obj.brand, 80),
    colour: str(obj.colour, 60),
    category: str(obj.category, 80),
    shortDescription: str(obj.shortDescription, 200),
    description: str(obj.description, 1200),
    material: str(obj.material, 80),
    style: str(obj.style, 60),
    notes: str(obj.notes, 300),
  };
  const g = str(obj.gender)?.toUpperCase();
  if (g && GENDERS.has(g)) out.gender = g as ProductSuggestion['gender'];
  if (Array.isArray(obj.tags)) {
    out.tags = obj.tags
      .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
      .filter(Boolean)
      .slice(0, 8);
  }
  return out;
}
