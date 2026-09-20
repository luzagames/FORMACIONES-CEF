# Armador de formaciones

Una página para armar la formación de un equipo de fútbol (el "once" probable) y **descargarla como imagen**, lista para publicar.

- Funciona en el navegador, en computadora o celular. No hay que instalar nada.
- Sin cuentas: lo que armas no se sube a ningún servidor.
- La imagen sale de 1080 × 1350 px, la proporción de un post vertical de Instagram (4:5).

## Qué puedes hacer

- **Elegir la formación:** 12 esquemas con un clic (4-4-2, 4-3-3, 4-2-3-1, 3-5-2…), o escribir otro, por ejemplo `3-4-1-2`.
- **Cargar los jugadores:** apellido y número de cada uno, con Enter para pasar al siguiente.
- **Moverlos a mano:** arrástralos en la vista previa. Con un clic sobre uno vas directo a su nombre.
- **Título y director técnico:** editables, y el DT se puede ocultar.
- **Escudo:** sube el tuyo (elegir archivo, soltar o pegar una imagen). Sin escudo se muestra uno genérico con los colores de la camiseta.
- **Camisetas:** 8 diseños (banda, rayas, mitades, franja…), colores propios, número opcional sobre la camiseta y una camiseta distinta para el arquero.
- **Colores de la gráfica:** tema claro, oscuro o césped, colores a medida, fondo transparente y tamaño de camisetas y nombres.
- **Guardar formaciones:** guarda varias en el navegador y cámbialas con un clic.
- **Descargar la imagen** en JPG o PNG.

## Cómo se usa

1. En **Alineación** elige el esquema y escribe los nombres. Si quieres, cambia el título y el director técnico.
2. En **Diseño** sube el escudo y elige camisetas y colores.
3. Debajo de la vista previa pulsa **Descargar JPG** (o PNG).

Los datos de ejemplo que trae la página reproducen la imagen de referencia del proyecto; reemplázalos con los tuyos.

## Exportar como imagen

Debajo de la vista previa hay tres controles:

- **Descargar JPG:** 1080 × 1350 px. Usa el color de fondo del tema elegido.
- **PNG:** igual, pero con **transparencia real** si activaste *Fondo transparente* en Diseño. Sirve para ponerla sobre otras imágenes.
- **Tamaño:** 1080 × 1350 o el doble (2160 × 2700) para imprimir o pantallas grandes.

El archivo se llama como el título y el director técnico, por ejemplo `probable-once-leonardo-ponzio.jpg` (si el DT está oculto o vacío, solo el título). La imagen se genera en el navegador, sin subir nada a internet ni usar librerías externas.

- **El escudo puesto por dirección web** solo se puede incluir si el sitio de origen lo permite. Si no, la imagen sale con el escudo genérico y la página avisa. Para evitarlo, sube el archivo del escudo desde *Diseño → Elegir imagen*.
- **Dentro de OBS** las descargas pueden estar bloqueadas. Para exportar usa un navegador normal (Chrome, Edge, Firefox o el celular).

## Publicarla en GitHub Pages

Para que cualquiera la use con solo abrir una dirección:

1. Crea un repositorio y sube el contenido de esta carpeta (que `panel.html` e `index.html` queden en la raíz del repositorio).
2. En el repositorio, entra a **Settings → Pages**, elige **Deploy from a branch**, tu rama y la carpeta `/ (root)`.
3. En unos minutos queda publicada en `https://TU-USUARIO.github.io/REPO/`.

En el plan gratuito de GitHub, Pages solo funciona con repositorios **públicos**.

Sube también el `index.html`: sin él, GitHub Pages muestra este README como página de inicio. El `index.html` abre `panel.html`, que es el armador.

Puedes dejar afuera de la publicación `relay/`, `server.js` e `iniciar.bat`, que solo se usan para transmisiones (más abajo).

## Pantallas de distintos tamaños

El armador se adapta desde un celular hasta un monitor grande: en pantallas angostas las pestañas se desplazan y los controles se agrandan para el dedo, y en pantallas anchas pasa a dos columnas (vista previa a la izquierda, controles a la derecha).

---

# Uso opcional en transmisiones (OBS)

Además de armar y exportar, la misma página puede manejar una gráfica en vivo en una transmisión con OBS. Nada de esto hace falta para armar y exportar la formación.

- **`overlay.html`** es lo que se ve en la transmisión: se agrega como *Fuente de navegador*.
- **`panel.html`** es el armador de siempre, que en OBS se usa como panel de control (*Dock de navegador personalizado*).

La gráfica del overlay entra y sale con animación desde el botón **Mostrar / Ocultar alineación** que hay arriba del panel. Cuando se abre OBS o el panel, la gráfica siempre arranca *fuera de pantalla*.

## En OBS, sin instalar nada

1. Descomprime la carpeta en un lugar fijo, por ejemplo `C:\OBS\alineaciones`. Si la mueves después, tendrás que cambiar las rutas en OBS.
2. **Overlay.** En OBS, en la escena que quieras: `+` → *Navegador*. **No marques "Archivo local"**: escribe la ruta como dirección en el campo URL, por ejemplo `file:///C:/OBS/alineaciones/overlay.html` (barras normales `/`, y `%20` si hay espacios). Pon ancho **1080** y alto **1350**. Puedes reescalarlo después en la escena: la gráfica se ajusta sola a cualquier tamaño.
3. **Panel.** Menú *Docks* (o *Paneles*) → *Custom Browser Docks* (*Paneles de navegador personalizados*). Nombre: `Alineaciones`. URL: la ruta de `panel.html` como archivo, por ejemplo `file:///C:/OBS/alineaciones/panel.html`. Aplicar.
4. Cuando el panel diga **Overlay conectado**, ya están sincronizados.

> **Por qué no "Archivo local":** según reportes de la comunidad de OBS, esa casilla carga la página con un esquema propio de OBS (`absolute/...`) y no con `file:///`. El panel y el overlay solo pueden comunicarse si usan el mismo esquema, así que con la casilla marcada quedan incomunicados.

Para probar el overlay en un navegador común: `overlay.html?tablero&demo` (tablero gris para ver la transparencia y una alineación de prueba). Sin esos parámetros el fondo es siempre transparente.

## Si no se conecta: servidor local

Si el panel dice **Sin señal del overlay** aunque ambos estén abiertos, primero revisa que el overlay **no** tenga marcada la casilla *Archivo local*. Si sigue igual, usa el servidor local. Necesita [Node.js](https://nodejs.org) 16 o superior y no instala nada más.

1. **En Windows:** doble clic en `iniciar.bat`. Se abre una ventana negra que debe quedar abierta mientras transmites. En otros sistemas: `node server.js` en la carpeta.
2. En OBS usa estas direcciones (sin marcar *Archivo local*):
   - Overlay: `http://localhost:4455/overlay.html`
   - Panel: `http://localhost:4455/panel.html`
3. Otro puerto: `PORT=5000 node server.js` (en Windows: `set PORT=5000` y luego `node server.js`).

En este modo la última alineación queda guardada en `estado.json`, y si recargas el overlay o el panel con la gráfica al aire, se mantiene.

## Relay: manejar el panel desde otro navegador o computadora

Sirve para manejar el panel desde **Chrome o Edge** (o desde otra computadora o el celular) y ver los cambios al instante en la gráfica que corre dentro de OBS. Un navegador normal y OBS son programas separados y no se comunican solos, así que el relay hace de intermediario por internet. Es un pequeño servicio en Cloudflare (plan gratuito).

**Publicarlo (una sola vez, lo hace quien desarrolla):**

1. Crea una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. En la carpeta `relay/` (necesita Node.js 18 o superior, solo en tu computadora):
   ```
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
   Al terminar imprime una dirección como `https://alineaciones-relay.TU-CUENTA.workers.dev`.
3. Abre `js/config.js` y pega esa dirección en `relay`. Sube el sitio.
4. Recomendado: en `relay/wrangler.toml` quita el `#` de `[vars]` y `ORIGENES` y pon la dirección donde publicaste el sitio (por ejemplo `https://TU-USUARIO.github.io`). Vuelve a ejecutar `npx wrangler deploy`. Así el relay solo acepta conexiones desde tu sitio.

**Usarlo (quien opera):**

1. Abre el panel publicado en Chrome o Edge y entra a la pestaña **Conexión**.
2. Copia la **dirección del overlay** y pégala en una fuente de navegador de OBS.
3. Cuando el panel diga **Overlay conectado (relay)**, todo lo que hagas en el panel se ve en la gráfica.
4. La misma pestaña te da la dirección del panel para abrirlo en otra computadora o en el celular.

**Cosas a saber:**

- **El código de sala hace de contraseña.** El panel genera uno de 12 caracteres y lo recuerda. Quien lo tenga puede controlar la alineación. Con *Código nuevo* se cambia (hay que volver a pegar la dirección del overlay).
- **Si el relay o internet se cae,** la gráfica que está al aire no se apaga sola. El panel avisa "Sin conexión con el relay", y al volver la conexión los cambios pendientes se envían solos.
- **Al abrir de nuevo,** el overlay y el panel recuperan la última alineación guardada en el relay. Si nadie estuvo conectado durante un tiempo, nunca se recupera una alineación "en pantalla" vieja: arranca oculta.
- **Cuota gratuita:** Cloudflare permite 100.000 solicitudes por día en este tipo de servicio, y cada 20 mensajes cuentan como una. Un programa de varias horas usa una fracción mínima. Si se superara, las operaciones fallan hasta las 00:00 UTC.
- **Probarlo en tu computadora:** dentro de `relay/`, `npx wrangler dev` levanta el relay en `http://127.0.0.1:8787`. Abre el panel con `?relay=http://127.0.0.1:8787` al final de la dirección.

---

## Archivos

```
index.html      abre panel.html (sin él, GitHub Pages muestra este README como inicio)
panel.html      el armador de formaciones
overlay.html    la gráfica para OBS (opcional)
server.js       servidor local opcional para OBS
iniciar.bat     abre server.js con doble clic en Windows
relay/          servicio de Cloudflare que conecta panel y overlay por internet (opcional)
js/shared.js    lógica común: formaciones, camiseta, dibujo, sincronización
js/panel.js     el armador
js/export.js    exporta la gráfica como imagen JPG o PNG
js/overlay.js   recepción y dibujo en OBS
js/config.js    dirección del relay (se completa una vez, solo si se usa)
css/            estilos de la gráfica y del panel
fonts/          fuente Archivo en local
```

La fuente incluida es Archivo (licencia SIL OFL, ver `fonts/LICENSE-Archivo.txt`).
