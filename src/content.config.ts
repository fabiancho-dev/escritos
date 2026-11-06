import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Si cambias esta lista, actualiza también TIPOS en scripts/nuevo.mjs
// y ETIQUETAS_TIPO en src/lib/lectura.ts.
export const TIPOS = ['articulo', 'reflexion', 'predica'] as const;

/**
 * Valor de `object-position` (p. ej. "70% 40%", "center", "left top").
 * Solo letras, dígitos, %, punto, guion y espacios: el valor termina en un
 * atributo `style`, así que no se admiten caracteres que puedan romperlo.
 */
const POSICION_IMAGEN = /^[a-z0-9%.\s-]+$/i;

const escritos = defineCollection({
  loader: glob({ base: './src/content/escritos', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z
      .object({
        titulo: z.string().trim().min(1),
        // YAML interpreta 2026-11-06 como fecha UTC; también acepta texto ISO.
        fecha: z.coerce.date(),
        resumen: z.string().trim().min(1).max(200),
        tipo: z.enum(TIPOS),

        /** Foto del hero, en src/assets/escritos/. */
        imagen: image().optional(),
        /** Texto alternativo; obligatorio si hay imagen. */
        imagenAlt: z.string().trim().min(1).optional(),
        /** Encuadre en móvil (object-position). */
        imagenPosicion: z.string().trim().min(1).max(40).regex(POSICION_IMAGEN).default('center'),
        /** Si es true, no se aplica el filtro en blanco y negro. */
        imagenColor: z.boolean().default(false),
        /** Sustituye el nombre del sitio en el header de este escrito. */
        marca: z.string().trim().min(1).max(60).optional(),
      })
      // `image().refine()` no está soportado; la regla se valida sobre el objeto.
      .refine((datos) => datos.imagen === undefined || datos.imagenAlt !== undefined, {
        message: 'imagenAlt es obligatorio cuando se define imagen.',
        path: ['imagenAlt'],
      }),
});

export const collections = { escritos };
