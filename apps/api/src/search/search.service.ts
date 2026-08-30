import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { loadEnv } from '@slay/config';
import { PrismaService } from '../prisma/prisma.service.js';

const env = loadEnv();

export interface SearchHit {
  id: string;
  name: string;
  slug: string;
  mrp: string;
  salePrice: string;
  currency: string;
  ratingAverage: number;
  ratingCount: number;
  media: { url: string; alt: string | null }[];
}

interface ProductDoc {
  id: string;
  name: string;
  slug: string;
  brandName: string | null;
  shortDescription: string | null;
  categories: string[];
  tags: string[];
  gender: string | null;
  status: string;
  mrp: number;
  salePrice: number;
  currency: string;
  ratingAverage: number;
  ratingCount: number;
  soldCount: number;
  publishedAt: string | null;
  media: { url: string; alt: string | null }[];
}

const PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  gender: true,
  mrp: true,
  salePrice: true,
  currency: true,
  ratingAverage: true,
  ratingCount: true,
  soldCount: true,
  shortDescription: true,
  publishedAt: true,
  deletedAt: true,
  brand: { select: { name: true } },
  categories: { select: { category: { select: { slug: true } } } },
  tags: { select: { tag: { select: { name: true } } } },
  media: { select: { url: true, alt: true }, orderBy: { position: 'asc' as const }, take: 1 },
};

/**
 * Product search with an Elasticsearch backend and an automatic Postgres
 * fallback. `query()` returns `null` when the caller should fall back.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly index = env.ELASTICSEARCH_PRODUCT_INDEX;
  private readonly client: Client | null;
  /** Elasticsearch was reachable on the last attempt. */
  private healthy = false;

  constructor(private readonly prisma: PrismaService) {
    if (env.SEARCH_DRIVER !== 'elasticsearch') {
      this.client = null;
      return;
    }
    this.client = new Client({
      node: env.ELASTICSEARCH_NODE,
      auth:
        env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD
          ? { username: env.ELASTICSEARCH_USERNAME, password: env.ELASTICSEARCH_PASSWORD }
          : undefined,
      requestTimeout: 4000,
      maxRetries: 1,
    });
  }

  get driver(): 'elasticsearch' | 'postgres' {
    return this.client ? 'elasticsearch' : 'postgres';
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.log('Search driver: postgres');
      return;
    }
    try {
      await this.ensureIndex();
      this.healthy = true;
      this.logger.log(`Search driver: elasticsearch (${env.ELASTICSEARCH_NODE})`);
    } catch (err) {
      this.healthy = false;
      this.logger.warn(
        `Elasticsearch unavailable at ${env.ELASTICSEARCH_NODE} — falling back to Postgres search. (${(err as Error).message})`,
      );
    }
  }

  async ensureIndex(): Promise<void> {
    if (!this.client) return;
    const exists = await this.client.indices.exists({ index: this.index });
    if (exists) return;
    await this.client.indices.create({
      index: this.index,
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          name: { type: 'search_as_you_type' },
          shortDescription: { type: 'text' },
          brandName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          categories: { type: 'keyword' },
          tags: { type: 'keyword' },
          gender: { type: 'keyword' },
          status: { type: 'keyword' },
          mrp: { type: 'double' },
          salePrice: { type: 'double' },
          currency: { type: 'keyword' },
          ratingAverage: { type: 'float' },
          ratingCount: { type: 'integer' },
          soldCount: { type: 'integer' },
          publishedAt: { type: 'date' },
        },
      },
    });
    this.logger.log(`Created Elasticsearch index "${this.index}"`);
  }

  private toDoc(p: {
    id: string;
    name: string;
    slug: string;
    status: string;
    gender: string | null;
    mrp: unknown;
    salePrice: unknown;
    currency: string;
    ratingAverage: number;
    ratingCount: number;
    soldCount: number;
    shortDescription: string | null;
    publishedAt: Date | null;
    brand: { name: string } | null;
    categories: { category: { slug: string } }[];
    tags: { tag: { name: string } }[];
    media: { url: string; alt: string | null }[];
  }): ProductDoc {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brandName: p.brand?.name ?? null,
      shortDescription: p.shortDescription,
      categories: p.categories.map((c) => c.category.slug),
      tags: p.tags.map((t) => t.tag.name),
      gender: p.gender,
      status: p.status,
      mrp: Number(p.mrp),
      salePrice: Number(p.salePrice),
      currency: p.currency,
      ratingAverage: p.ratingAverage,
      ratingCount: p.ratingCount,
      soldCount: p.soldCount,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      media: p.media,
    };
  }

  /** Re-index every non-deleted product. Returns the number indexed. */
  async reindexAll(): Promise<{ driver: string; indexed: number; healthy: boolean }> {
    if (!this.client) return { driver: 'postgres', indexed: 0, healthy: false };
    await this.ensureIndex();
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      select: PRODUCT_SELECT,
    });
    if (products.length) {
      const operations = products.flatMap((p) => [
        { index: { _index: this.index, _id: p.id } },
        this.toDoc(p),
      ]);
      const res = await this.client.bulk({ operations, refresh: true });
      if (res.errors) {
        this.logger.warn('Some documents failed to index during reindexAll');
      }
    }
    this.healthy = true;
    return { driver: 'elasticsearch', indexed: products.length, healthy: true };
  }

  async indexProduct(id: string): Promise<void> {
    if (!this.client) return;
    try {
      const product = await this.prisma.product.findUnique({ where: { id }, select: PRODUCT_SELECT });
      if (!product || product.deletedAt) {
        await this.removeProduct(id);
        return;
      }
      await this.client.index({ index: this.index, id, document: this.toDoc(product) });
      this.healthy = true;
    } catch (err) {
      this.healthy = false;
      this.logger.warn(`indexProduct(${id}) failed: ${(err as Error).message}`);
    }
  }

  async removeProduct(id: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.delete({ index: this.index, id }, { ignore: [404] });
    } catch {
      /* best effort */
    }
  }

  /**
   * Returns product cards, or `null` if the caller should use its Postgres query
   * (search driver is postgres, or Elasticsearch is currently unreachable).
   */
  async query(term: string, opts: { limit?: number } = {}): Promise<SearchHit[] | null> {
    if (!this.client) return null;
    const limit = Math.min(48, opts.limit ?? 12);
    try {
      const res = await this.client.search<ProductDoc>({
        index: this.index,
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: term,
                  type: 'bool_prefix',
                  fuzziness: 'AUTO',
                  fields: [
                    'name^3',
                    'name._2gram',
                    'name._3gram',
                    'brandName^2',
                    'shortDescription',
                    'tags^2',
                  ],
                },
              },
            ],
            filter: [{ term: { status: 'ACTIVE' } }],
          },
        },
      });
      this.healthy = true;
      return res.hits.hits
        .map((h) => h._source)
        .filter((d): d is ProductDoc => Boolean(d))
        .map((d) => ({
          id: d.id,
          name: d.name,
          slug: d.slug,
          mrp: String(d.mrp),
          salePrice: String(d.salePrice),
          currency: d.currency,
          ratingAverage: d.ratingAverage,
          ratingCount: d.ratingCount,
          media: d.media ?? [],
        }));
    } catch (err) {
      this.healthy = false;
      this.logger.warn(`Elasticsearch query failed, falling back to Postgres: ${(err as Error).message}`);
      return null;
    }
  }

  status() {
    return { driver: this.driver, healthy: this.driver === 'postgres' ? true : this.healthy };
  }
}
