import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Si cambias esta lista, actualiza también TIPOS en scripts/nuevo.mjs.
export const TIPOS = ['articulo', 'reflexion', 'predica'] as const;

const escritos = defineCollection({
  loader: glob({ base: './src/content/escritos', pattern: '**/*.md' }),
  schema: z.object({
    titulo: z.string().trim().min(1),
    // YAML interpreta 2026-11-06 como fecha UTC; también acepta texto ISO.
    fecha: z.coerce.date(),
    resumen: z.string().trim().min(1).max(200),
    tipo: z.enum(TIPOS),
  }),
});

export const collections = { escritos };
