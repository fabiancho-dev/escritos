# Escritos

Sitio estático (Astro) con artículos, reflexiones y notas de prédicas, publicado en GitHub Pages:
<https://fabiancho-dev.github.io/escritos/>

> ## ⚠ Este repositorio es público
> Cualquiera puede leer **todos** los escritos en GitHub, incluido el historial de cambios, aunque no conozca la URL del sitio.
> Los slugs aleatorios y el `noindex` solo evitan que los buscadores los listen: **ocultar la URL no equivale a privacidad**.
> No publiques aquí nada que no quieras que sea público. Borrar un escrito no lo elimina del historial de git.

## Publicar un escrito

1. En Google Docs: **Archivo → Descargar → Markdown (.md)**.
2. Crear el escrito:
   ```powershell
   npm run nuevo -- "Título del escrito" --tipo reflexion --resumen "Texto breve" --archivo "C:\ruta\documento.md" --imagen "C:\ruta\foto.jpg" --alt "Descripción de la foto" --posicion "62% 40%"
   ```
3. Revisar el archivo creado en `src/content/escritos/` y verlo con `npm run dev`.
4. Publicar:
   ```powershell
   git add . ; git commit -m "Nuevo escrito: título" ; git push
   ```
   GitHub Actions despliega en uno o dos minutos (`gh run watch` para seguirlo).

### Opciones de `npm run nuevo`

| Opción | Obligatoria | Descripción |
|---|---|---|
| `"Título"` | sí | Primer argumento, entre comillas. |
| `--tipo` | sí | `articulo`, `reflexion` o `predica`. |
| `--resumen` | sí | Máximo 200 caracteres. Se muestra como subtítulo y en la descripción. |
| `--archivo` | no | Markdown exportado de Google Docs; se limpia al importar. |
| `--imagen` | no | Foto del encabezado (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`). Se copia a `src/assets/escritos/<slug>.<ext>`. |
| `--alt` | con `--imagen` | Texto alternativo de la foto. Sin él, el script falla. |
| `--posicion` | no | Encuadre de la foto en móvil, p. ej. `"70% 40%"` (por defecto `center`). Porcentaje horizontal y vertical del punto de la foto que se mantiene a la vista. |
| `--marca` | no | Texto que sustituye el nombre del sitio en el header de ese escrito. |

Al terminar imprime la ruta creada y la URL final. Sin `--imagen` el escrito sale con cabecera solo tipográfica.

### Campos del escrito (frontmatter)

`titulo`, `fecha`, `resumen` (≤ 200) y `tipo` son obligatorios. Opcionales: `imagen` (ruta relativa a `src/assets/escritos/`), `imagenAlt` (obligatorio si hay `imagen`), `imagenPosicion` (por defecto `"center"`), `imagenColor` (`true` desactiva el blanco y negro; por defecto `false`) y `marca`.

El tiempo de lectura se calcula solo (~210 palabras por minuto, mínimo 1 minuto).

## Borrar un escrito

Borra el `.md` y, si tiene, su imagen en `src/assets/escritos/`:

```powershell
git rm src/content/escritos/<slug>.md src/assets/escritos/<slug>.png ; git commit -m "Borrar escrito" ; git push
```

Recuerda: el contenido sigue en el historial de git. El escrito de ejemplo es `el-valor-de-caminar-juntos-nxmdg.md` (con su imagen del mismo nombre); se borra igual.

## Ver el sitio en local

```powershell
npm install   # solo la primera vez
npm run dev   # http://localhost:4321/escritos/
```

Otros comandos: `npm run build` (compila a `dist/`), `npm run preview`, `npm run check` (tipos).

## Diseño

Solo tema oscuro. Todos los colores, fuentes, escala tipográfica, espacios, radios, duraciones y degradados están en `src/styles/tokens.css`; `src/styles/base.css` solo consume esas variables. El nombre del sitio está en `src/config.ts` (`SITE_NOMBRE`).

- Títulos y letra capital: Cambo (solo peso regular; no se le aplica negrita ni cursiva).
- Cuerpo: Source Serif 4 (cursiva y negrita reales). Ambas fuentes van autoalojadas.
- No hay menú, búsqueda ni enlaces entre escritos: cada página muestra únicamente su escrito.
- `referencias/` (mockup y foto de trabajo) está en `.gitignore` y no se publica.

## Requisitos

Node ≥ 22.23.4 (lo exige Astro 7).
