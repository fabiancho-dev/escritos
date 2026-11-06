// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://fabiancho-dev.github.io',
  base: '/escritos',
  trailingSlash: 'always',
  markdown: {
    // Sin resaltado de Shiki: inyecta colores fijos en línea que no respetan
    // el tema claro/oscuro. Los bloques de código se estilan con tokens.css.
    syntaxHighlight: false,
  },
});
