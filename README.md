# Abyss Blade · El umbral

Versión web. Contiene el código HTML, CSS y JavaScript, los recursos del juego y Three.js incluido. No requiere instalación ni compilación.

## GitHub Pages
1. Descomprime el ZIP y sube **su contenido** a la raíz de la rama `main` del repositorio. `index.html` debe quedar junto a `art/`, `assets/` y `vendor/`.
2. En GitHub, abre **Settings → Pages**. En **Build and deployment**, elige **Deploy from a branch**, la rama **main** y **/(root)**. Guarda.
3. Espera el despliegue y abre el enlace que muestre GitHub Pages.

Guía oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

GitHub Pages puede hacer accesible el juego públicamente. Si quieres conservar el acceso privado, usa el enlace privado de la demo.

## Prueba local
Con Python instalado, abre una terminal en la carpeta descomprimida y ejecuta `python -m http.server 8000`. En Windows también puedes usar `py -m http.server 8000`. Después abre http://localhost:8000. Los módulos del juego requieren un servidor web; no abras index.html por doble clic.

## Controles
A/D o flechas: moverse · Espacio: saltar · J: atacar · K: esquivar · E: interactuar · I: inventario y amuletos · M: mapa · Esc: pausa.

Las partidas se guardan en el navegador, de forma independiente para cada dirección web.
