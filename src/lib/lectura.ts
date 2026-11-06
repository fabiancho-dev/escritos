import type { CollectionEntry } from 'astro:content';

type Tipo = CollectionEntry<'escritos'>['data']['tipo'];

/** Etiqueta visible de cada tipo. Al ser un Record, TypeScript exige cubrir todos. */
export const ETIQUETAS_TIPO: Record<Tipo, string> = {
  articulo: 'Artículos',
  reflexion: 'Reflexiones',
  predica: 'Prédicas',
};

const PALABRAS_POR_MINUTO = 210;

/** Cuenta palabras del Markdown ignorando comentarios, código, imágenes y URLs. */
export function contarPalabras(markdown: string): number {
  const texto = markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\[[^\]]+\]:\s.*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ');
  return texto.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Minutos de lectura a ~210 palabras por minuto, mínimo 1. */
export function minutosDeLectura(markdown: string): number {
  return Math.max(1, Math.ceil(contarPalabras(markdown) / PALABRAS_POR_MINUTO));
}

/** Fecha larga en español de Colombia. */
export function fechaLarga(fecha: Date): string {
  // La fecha del frontmatter es un día calendario (medianoche UTC): se formatea
  // en UTC para que no retroceda un día al convertirla a hora de Colombia.
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(fecha);
}
