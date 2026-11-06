#!/usr/bin/env node
// @ts-check
/**
 * Crea un escrito nuevo en src/content/escritos/.
 *
 * Uso:
 *   npm run nuevo -- "Título" --tipo reflexion --resumen "Texto breve" \
 *     [--archivo "C:\ruta\doc.md"] [--imagen "C:\ruta\foto.jpg" --alt "Descripción"]
 *     [--posicion "70% 40%"] [--marca "Texto"]
 *
 * Sin dependencias externas. Solo se ejecuta como script (el import de
 * astro.config.mjs es para leer `site` y `base`, única fuente de verdad).
 */

import { randomInt } from 'node:crypto';
import {
  constants as fsConstants,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import config from '../astro.config.mjs';

// Mantener sincronizado con TIPOS en src/content.config.ts.
const TIPOS = ['articulo', 'reflexion', 'predica'];
const RESUMEN_MAX = 200;
const SLUG_MAX = 50;
const SUFIJO_LARGO = 5;
const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ZONA_HORARIA = 'America/Bogota';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_ESCRITOS = join(RAIZ, 'src', 'content', 'escritos');
const DIR_IMAGENES = join(RAIZ, 'src', 'assets', 'escritos');

const EXTENSIONES_IMAGEN = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const IMAGEN_AVISO_BYTES = 8 * 1024 * 1024;
// Igual que POSICION_IMAGEN en src/content.config.ts.
const POSICION_VALIDA = /^[a-z0-9%.\s-]+$/i;
const POSICION_MAX = 40;
const MARCA_MAX = 60;

const USO = `
Uso:
  npm run nuevo -- "Título del escrito" --tipo <tipo> --resumen "Texto breve" [opciones]

Obligatorias:
  --tipo        ${TIPOS.join(' | ')}
  --resumen     Máximo ${RESUMEN_MAX} caracteres

Opcionales:
  --archivo     Markdown exportado de Google Docs para importar
  --imagen      Foto del encabezado (${EXTENSIONES_IMAGEN.join(', ')}); se copia a src/assets/escritos/
  --alt         Texto alternativo de la foto (obligatorio si se usa --imagen)
  --posicion    Encuadre de la foto en móvil, p. ej. "70% 40%" (por defecto: center)
  --marca       Texto que sustituye el nombre del sitio en el header de este escrito
  -h, --ayuda   Muestra este mensaje
`;

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

/** Quita tildes y diacríticos. */
const sinTildes = (/** @type {string} */ texto) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '');

/**
 * "¿Qué es la fe? — Una reflexión" -> "que-es-la-fe-una-reflexion"
 * Máximo SLUG_MAX caracteres, cortando en límite de palabra cuando es posible.
 */
export function crearSlugBase(/** @type {string} */ titulo) {
  const completo = sinTildes(titulo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (completo.length <= SLUG_MAX) return completo || 'escrito';

  const corte = completo.slice(0, SLUG_MAX);
  const ultimoGuion = corte.lastIndexOf('-');
  // Si el siguiente carácter ya era guion, el corte cayó justo entre palabras.
  const limpio =
    completo[SLUG_MAX] === '-' || ultimoGuion < SLUG_MAX / 2
      ? corte
      : corte.slice(0, ultimoGuion);
  return limpio.replace(/-+$/g, '') || 'escrito';
}

/** Sufijo aleatorio criptográficamente seguro, sin sesgo de módulo. */
export function sufijoAleatorio(longitud = SUFIJO_LARGO) {
  let s = '';
  for (let i = 0; i < longitud; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de Bogotá. */
export function fechaHoyBogota(ahora = new Date()) {
  // 'en-CA' formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Cadena YAML entre comillas dobles (JSON es un subconjunto válido de YAML). */
const yamlTexto = (/** @type {string} */ s) =>
  JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Normaliza para comparar títulos: sin tildes, marcas ni puntuación. */
const normalizarTitulo = (/** @type {string} */ s) =>
  sinTildes(s)
    .toLowerCase()
    .replace(/\\(.)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// ---------------------------------------------------------------------------
// Importación y limpieza de Markdown (Google Docs)
// ---------------------------------------------------------------------------

/**
 * Desescapa una línea de texto (fuera de bloques y código en línea),
 * conservando las barras que sí cambian el significado del Markdown.
 */
function desescaparTexto(/** @type {string} */ texto) {
  // Caracteres que Google Docs escapa sin necesidad en prosa normal.
  const SEGUROS = new Set(['.', ',', ':', ';', "'", '"', '(', ')', '-', '!', '+', '=', '&', '%', '@', '$', '?', '^', '/', '{', '}']);
  const inicioLinea = texto.match(/^\s*/)?.[0].length ?? 0;
  let salida = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const sig = texto[i + 1];
    if (c !== '\\' || sig === undefined || !SEGUROS.has(sig)) {
      salida += c;
      continue;
    }
    const antes = texto.slice(inicioLinea, i);
    const alInicio = i === inicioLinea;
    const sigue = texto.slice(i + 2);
    const riesgoso =
      // "1\." o "1\)" al inicio: evita que se convierta en lista ordenada.
      ((sig === '.' || sig === ')') && /^\d+$/.test(antes)) ||
      // "\-", "\+", "\=" al inicio: lista o subrayado de encabezado.
      (alInicio && (sig === '-' || sig === '+' || sig === '=')) ||
      // "\![": imagen literal.
      (sig === '!' && sigue.startsWith('[')) ||
      // "]\(": evita crear un enlace "[texto](url)".
      (sig === '(' && texto[i - 1] === ']') ||
      // "\&amp;": evita crear una entidad HTML.
      (sig === '&' && /^(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/i.test(sigue));
    if (riesgoso) {
      salida += c;
    } else {
      salida += sig;
      i++;
    }
  }
  return salida;
}

/** Aplica `fn` solo fuera de código en línea (`...`). */
function fueraDeCodigoEnLinea(
  /** @type {string} */ linea,
  /** @type {(t: string) => string} */ fn,
) {
  let resultado = '';
  let ultimo = 0;
  for (const m of linea.matchAll(/(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g)) {
    resultado += fn(linea.slice(ultimo, m.index)) + m[0];
    ultimo = m.index + m[0].length;
  }
  return resultado + fn(linea.slice(ultimo));
}

/**
 * Detecta imágenes que no se pueden publicar. No modifica el texto.
 * @returns {{ base64: number, referencias: number, remotas: number, locales: number }}
 */
export function detectarImagenes(/** @type {string} */ md) {
  const base64 = (md.match(/data:image\/[a-z0-9.+-]+;base64,/gi) ?? []).length;
  // ![alt][ref] y ![][imageN], como exporta Google Docs
  const referencias = (md.match(/!\[[^\]\n]*\](?:\[[^\]\n]*\])(?!\()/g) ?? []).length;
  let remotas = 0;
  let locales = 0;
  for (const m of md.matchAll(/!\[[^\]\n]*\]\(\s*<?([^)\s>]+)/g)) {
    if (/^https?:\/\//i.test(m[1])) remotas++;
    else if (!m[1].startsWith('data:')) locales++;
  }
  return { base64, referencias, remotas, locales };
}

/**
 * Limpia un Markdown exportado de Google Docs.
 * @returns {{ texto: string, tituloEliminado: boolean }}
 */
export function limpiarMarkdown(/** @type {string} */ original, /** @type {string} */ titulo) {
  let md = original
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '');

  const lineas = md.split('\n');
  const limpias = [];
  let cerco = null; // marcador del bloque de código abierto, p. ej. "```"

  for (const linea of lineas) {
    const abre = linea.match(/^\s*(`{3,}|~{3,})/);
    if (cerco) {
      limpias.push(linea); // el contenido de los bloques de código no se toca
      if (abre && abre[1][0] === cerco[0] && abre[1].length >= cerco.length && /^\s*(`{3,}|~{3,})\s*$/.test(linea)) {
        cerco = null;
      }
      continue;
    }
    if (abre) {
      cerco = abre[1];
      limpias.push(linea.replace(/\s+$/, ''));
      continue;
    }
    limpias.push(
      fueraDeCodigoEnLinea(linea, (t) =>
        desescaparTexto(t.replace(/\u00A0/g, ' ').replace(/(\S) {2,}/g, '$1 ')),
      ).replace(/\s+$/, ''),
    );
  }

  md = limpias.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Título duplicado: primer contenido es "# Título" o "Título\n===".
  let tituloEliminado = false;
  const objetivo = normalizarTitulo(titulo);
  const atx = md.match(/^#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*(?:\n|$)/);
  const setext = md.match(/^([^\n]+)\n=+[ \t]*(?:\n|$)/);
  const encontrado = atx ?? setext;
  if (encontrado && normalizarTitulo(encontrado[1]) === objetivo) {
    md = md.slice(encontrado[0].length).replace(/^\n+/, '');
    tituloEliminado = true;
  }

  return { texto: md.trim(), tituloEliminado };
}

// ---------------------------------------------------------------------------
// Programa principal
// ---------------------------------------------------------------------------

function fallar(/** @type {string[]} */ mensajes) {
  for (const m of mensajes) console.error(`✖ ${m}`);
  console.error(USO);
  process.exit(1);
}

function main() {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        tipo: { type: 'string' },
        resumen: { type: 'string' },
        archivo: { type: 'string' },
        imagen: { type: 'string' },
        alt: { type: 'string' },
        posicion: { type: 'string' },
        marca: { type: 'string' },
        ayuda: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    return fallar([error instanceof Error ? error.message : String(error)]);
  }

  const { values, positionals } = parsed;
  if (values.ayuda) {
    console.log(USO);
    return;
  }

  const titulo = positionals.join(' ').trim();
  const resumen = values.resumen?.trim() ?? '';
  const tipo = values.tipo?.trim() ?? '';
  const errores = [];

  if (!titulo) errores.push('Falta el título (primer argumento, entre comillas).');
  if (!tipo) errores.push(`Falta --tipo. Valores válidos: ${TIPOS.join(', ')}.`);
  else if (!TIPOS.includes(tipo)) errores.push(`--tipo "${tipo}" no es válido. Valores válidos: ${TIPOS.join(', ')}.`);
  if (!resumen) errores.push('Falta --resumen (texto breve).');
  else if (resumen.length > RESUMEN_MAX) errores.push(`--resumen tiene ${resumen.length} caracteres; el máximo es ${RESUMEN_MAX}.`);

  let rutaArchivo = null;
  if (values.archivo !== undefined) {
    rutaArchivo = resolve(values.archivo);
    if (!existsSync(rutaArchivo)) errores.push(`No existe el archivo: ${rutaArchivo}`);
    else if (extname(rutaArchivo).toLowerCase() !== '.md') errores.push(`--archivo debe ser un .md: ${rutaArchivo}`);
  }

  // Imagen del encabezado
  const alt = values.alt?.trim() ?? '';
  const posicion = values.posicion?.trim() ?? '';
  const marca = values.marca?.trim() ?? '';
  let rutaImagen = null;
  let extensionImagen = '';
  if (values.imagen !== undefined) {
    rutaImagen = resolve(values.imagen);
    extensionImagen = extname(rutaImagen).toLowerCase();
    if (!existsSync(rutaImagen) || !statSync(rutaImagen).isFile()) errores.push(`No existe la imagen: ${rutaImagen}`);
    else if (!EXTENSIONES_IMAGEN.includes(extensionImagen)) errores.push(`--imagen debe ser ${EXTENSIONES_IMAGEN.join(', ')}: ${rutaImagen}`);
    if (!alt) errores.push('--imagen requiere --alt con el texto alternativo de la foto (accesibilidad).');
  } else {
    if (values.alt !== undefined) errores.push('--alt solo se puede usar junto con --imagen.');
    if (values.posicion !== undefined) errores.push('--posicion solo se puede usar junto con --imagen.');
  }
  if (values.posicion !== undefined && (!posicion || posicion.length > POSICION_MAX || !POSICION_VALIDA.test(posicion))) {
    errores.push(`--posicion no es válida (ejemplos: "70% 40%", "center", "left top"; máximo ${POSICION_MAX} caracteres).`);
  }
  if (values.marca !== undefined && (!marca || marca.length > MARCA_MAX)) {
    errores.push(`--marca no puede estar vacía ni superar ${MARCA_MAX} caracteres.`);
  }
  if (errores.length > 0) return fallar(errores);

  // Cuerpo
  let cuerpo = '<!-- Escribe aquí el texto del escrito. -->';
  /** @type {string[]} */
  const avisos = [];
  if (rutaArchivo) {
    let original;
    try {
      original = readFileSync(rutaArchivo, 'utf8');
    } catch (error) {
      return fallar([`No se pudo leer ${rutaArchivo}: ${error instanceof Error ? error.message : error}`]);
    }
    if (/^\uFEFF?---\r?\n/.test(original)) {
      return fallar(['El archivo ya empieza con frontmatter (---). Quítalo antes de importar.']);
    }
    const { texto, tituloEliminado } = limpiarMarkdown(original, titulo);
    cuerpo = texto || cuerpo;
    avisos.push(tituloEliminado ? '✔ Se eliminó el título duplicado del cuerpo.' : '• El cuerpo no empezaba con un título igual al del escrito; no se quitó nada.');

    const img = detectarImagenes(original);
    if (img.base64 > 0) avisos.push(`⚠ ${img.base64} imagen(es) incrustada(s) en base64 (aumentan mucho el tamaño del archivo). Este sitio no publica imágenes: elimínalas del .md.`);
    if (img.referencias > 0) avisos.push(`⚠ ${img.referencias} referencia(s) de imagen del tipo ![][imagenN]. No se publicarán: aparecerán como texto roto. Elimínalas.`);
    if (img.locales > 0) avisos.push(`⚠ ${img.locales} imagen(es) con ruta local. No se publicarán: el sitio no incluye carpeta de imágenes.`);
    if (img.remotas > 0) avisos.push(`⚠ ${img.remotas} imagen(es) con URL externa. Se cargarán desde ese servidor (no se alojan aquí); si el enlace deja de existir, desaparecerán.`);
  }

  // Slug único, creado de forma atómica (flag 'wx') para evitar colisiones.
  const base = crearSlugBase(titulo);
  const fecha = fechaHoyBogota();

  mkdirSync(DIR_ESCRITOS, { recursive: true });
  let slug = '';
  let ruta = '';
  let rutaImagenCopiada = '';
  for (let intento = 0; ; intento++) {
    if (intento >= 50) return fallar(['No se pudo generar un nombre único tras 50 intentos.']);
    slug = `${base}-${sufijoAleatorio()}`;
    ruta = join(DIR_ESCRITOS, `${slug}.md`);
    const destinoImagen = rutaImagen ? join(DIR_IMAGENES, `${slug}${extensionImagen}`) : '';
    if (destinoImagen && existsSync(destinoImagen)) continue;

    const lineas = ['---', `titulo: ${yamlTexto(titulo)}`, `fecha: ${fecha}`, `resumen: ${yamlTexto(resumen)}`, `tipo: ${tipo}`];
    if (rutaImagen) {
      // Ruta relativa al .md, como exige el helper image() de las colecciones.
      lineas.push(`imagen: ../../assets/escritos/${slug}${extensionImagen}`, `imagenAlt: ${yamlTexto(alt)}`);
      if (posicion) lineas.push(`imagenPosicion: ${yamlTexto(posicion)}`);
    }
    if (marca) lineas.push(`marca: ${yamlTexto(marca)}`);
    lineas.push('---', '');

    try {
      writeFileSync(ruta, `${lineas.join('\n')}\n${cuerpo}\n`, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EEXIST') continue;
      throw error;
    }

    if (rutaImagen) {
      try {
        mkdirSync(DIR_IMAGENES, { recursive: true });
        copyFileSync(rutaImagen, destinoImagen, fsConstants.COPYFILE_EXCL);
        rutaImagenCopiada = destinoImagen;
      } catch (error) {
        unlinkSync(ruta); // no dejar un escrito que apunta a una imagen inexistente
        return fallar([`No se pudo copiar la imagen: ${error instanceof Error ? error.message : error}`]);
      }
      if (statSync(rutaImagen).size > IMAGEN_AVISO_BYTES) {
        avisos.push('⚠ La imagen pesa más de 8 MB. Se optimiza al compilar, pero aumenta el tamaño del repositorio.');
      }
    }
    break;
  }

  const baseUrl = String(config.base ?? '').replace(/^\/*|\/*$/g, '');
  const sitio = String(config.site ?? '').replace(/\/+$/, '');
  const url = `${sitio}/${baseUrl ? `${baseUrl}/` : ''}${slug}/`;

  console.log('');
  for (const a of avisos) console.log(a);
  console.log(`\n✔ Escrito creado: ${relative(process.cwd(), ruta) || ruta}`);
  if (rutaImagenCopiada) console.log(`  Imagen copiada: ${relative(process.cwd(), rutaImagenCopiada) || rutaImagenCopiada}`);
  console.log(`  URL final:      ${url}\n`);
}

// Ejecutar solo si se invoca directamente (no al importar para pruebas).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
