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
   npm run nuevo -- "Título del escrito" --tipo reflexion --resumen "Texto breve" --archivo "C:\ruta\documento.md"
   ```
   - `--tipo`: `articulo`, `reflexion` o `predica`.
   - `--resumen`: máximo 200 caracteres.
   - `--archivo` es opcional; sin él se crea el escrito vacío para escribirlo a mano.
   - Al terminar imprime la ruta creada y la URL final.
3. Revisar el archivo creado en `src/content/escritos/` (y las advertencias de imágenes, que este sitio no publica) y verlo localmente con `npm run dev`.
4. Publicar:
   ```powershell
   git add . ; git commit -m "Nuevo escrito: título" ; git push
   ```
   GitHub Actions despliega en uno o dos minutos (`gh run watch` para seguirlo).

## Borrar un escrito

```powershell
git rm src/content/escritos/<slug>.md ; git commit -m "Borrar escrito" ; git push
```

Recuerda: el contenido sigue en el historial de git. El escrito de ejemplo inicial es `ejemplo-borrame-a65vs.md`; se borra igual.

## Ver el sitio en local

```powershell
npm install   # solo la primera vez
npm run dev   # http://localhost:4321/escritos/
```

Otros comandos: `npm run build` (compila a `dist/`), `npm run preview`, `npm run check` (tipos).

## Diseño

Todos los colores, fuentes y medidas están en `src/styles/tokens.css`. `src/styles/base.css` solo consume esas variables.

## Requisitos

Node ≥ 22.23.4 (lo exige Astro 7).
