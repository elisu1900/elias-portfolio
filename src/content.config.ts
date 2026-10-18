import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Case studies. One markdown file per language under src/content/work/<locale>/,
 * so the work index can filter straight on `locale`.
 */
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    stack: z.array(z.string()),
    year: z.number(),
    locale: z.enum(['en', 'es']),
    /** Company or client site. */
    url: z.string().optional(),
    /** The live product itself. */
    productUrl: z.string().optional(),
    featured: z.boolean().default(false),
    /** Lower sorts first on the work index. */
    order: z.number().default(0),
  }),
});

export const collections = { work };
