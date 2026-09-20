# Alineaciones para OBS

Gráfica de alineación de fútbol ("Probable once") que se controla en vivo desde un panel dentro de OBS.

- **overlay.html**: lo que se ve en pantalla. Se agrega como *Fuente de navegador*.
- **panel.html**: el panel de control. Se agrega como *Dock de navegador personalizado*.

Todo funciona sin internet (la fuente va incluida) y sin instalar nada.

## Instalación (sin instalar nada)

1. Descomprime la carpeta en un lugar fijo, por ejemplo `C:\OBS\alineaciones`. Si la mueves después, tendrás que cambiar las rutas en OBS.
2. **Overlay.** En OBS, en la escena que quieras: `+` → *Navegador*. **No marques "Archivo local"**: escribe la ruta como dirección en el campo URL, con el mismo formato que el dock, por ejemplo `file:///C:/OBS/alineaciones/overlay.html` (barras normales `/`, y `%20` si hay espacios). Pon ancho **1080** y alto **1350**. Puedes reescalarlo después en la escena; la gráfica se ajusta sola a cualquier tamaño.
3. **Panel.** Menú *Docks* (o *Paneles*) → *Custom Browser Docks* (*Paneles de navegador personalizados*). Nombre: `Alineaciones`. URL: la ruta de `panel.html` como archivo, por ejemplo `file:///C:/OBS/alineaciones/panel.html`. Aplicar.
4. Cuando el panel diga **Overlay conectado**, ya están sincronizados.

> **Por qué no "Archivo local":** según reportes de la comunidad de OBS, esa casilla carga la página con un esquema propio de OBS (`absolute/...`) y no con `file:///`. El panel y el overlay solo pueden comunicarse si usan el mismo esquema, así que con la casilla marcada quedan incomunicados.

## Uso

- **Mostrar alineación** / **Ocultar alineación**: entra y sale con animación. Al abrir OBS o el panel, la gráfica siempre arranca *fuera de pantalla*.
- **Alineación**: elige la formación (o escribe otra, por ejemplo `3-4-1-2`), edita título, DT, números y apellidos. Con Enter pasas al siguiente jugador.
- **Mover jugadores**: arrástralos en la vista previa. Un clic sobre uno te lleva a su nombre. *Restablecer posiciones* vuelve al esquema de la formación.
- **Diseño**: escudo (elegir archivo, soltar o pegar una imagen, o una dirección web), diseño y colores de la camiseta, camiseta distinta para el arquero, tema claro, oscuro o césped, fondo transparente, tamaños.
- **Guardadas**: guarda la alineación del local y la del visitante antes del partido y cámbialas con un clic. Cargar una guardada no la saca de pantalla si estaba en el aire.

Los cambios se ven en el overlay al instante, incluso con la gráfica en pantalla.

## Si no se conecta (modo servidor)

Primero revisa que el overlay **no** tenga marcada la casilla *Archivo local* (ver arriba). Si el panel sigue diciendo **Sin señal del overlay** aunque ambos estén abiertos, usa el servidor local. Necesita [Node.js](https://nodejs.org) 16 o superior y no instala nada más.

1. **En Windows:** haz doble clic en `iniciar.bat`. Se abre una ventana negra que debe quedar abierta mientras transmites. En otros sistemas: `node server.js` en la carpeta.
2. En OBS usa estas direcciones (sin marcar *Archivo local*):
   - Overlay: `http://localhost:4455/overlay.html`
   - Panel: `http://localhost:4455/panel.html`
3. Otro puerto: `PORT=5000 node server.js` (en Windows: `set PORT=5000` y luego `node server.js`).

En este modo la última alineación queda guardada en `estado.json`, y si recargas el overlay o el panel con la gráfica en el aire, se mantiene.

## Relay (panel en un navegador y overlay en vMix u OBS)

Sirve para manejar el panel desde **Chrome o Edge** (o desde otra computadora o el celular) y ver los cambios al instante en la gráfica que corre dentro de vMix u OBS. Un navegador normal y la entrada de vMix son programas separados y no se comunican solos, así que el relay hace de intermediario por internet. Es un pequeño servicio en Cloudflare (plan gratuito) y el cliente no instala nada.

**Publicarlo (una sola vez, lo hace quien desarrolla):**

1. Crea una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. En la carpeta `relay/` (necesita Node.js 18 o superior, solo en tu computadora):
   ```
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
   Al terminar imprime una dirección como `https://alineaciones-relay.TU-CUENTA.workers.dev`.
3. Abre `js/config.js` y pega esa dirección en `relay`. Sube el sitio (por ejemplo a GitHub Pages, ver más arriba).
4. Recomendado: en `relay/wrangler.toml` quita el `#` de `[vars]` y `ORIGENES` y pon la dirección donde publicaste el sitio (por ejemplo `https://TU-USUARIO.github.io`). Vuelve a ejecutar `npx wrangler deploy`. Así el relay solo acepta conexiones desde tu sitio.

**Usarlo (quien opera):**

1. Abre `panel.html` publicado en Chrome o Edge y entra a la pestaña **Conexión**.
2. Copia la **dirección del overlay** y pégala en una entrada *Web Browser* de vMix (o en una fuente de navegador de OBS). No hace falta recortar nada: es solo la gráfica, y oculta es transparente.
3. Cuando el panel diga **Overlay conectado (relay)**, todo lo que hagas en el panel se ve en la gráfica.
4. La misma pestaña te da la dirección del panel para abrirlo en otra computadora o en el celular.

**Cosas a saber:**

- **El código de sala hace de contraseña.** El panel genera uno de 12 caracteres y lo recuerda. Quien lo tenga puede controlar la alineación. Con *Código nuevo* se cambia (hay que volver a pegar la dirección del overlay).
- **Si el relay o internet se cae,** la gráfica que está al aire no se apaga sola. El panel avisa "Sin conexión con el relay", y al volver la conexión los cambios pendientes se envían solos.
- **Al abrir de nuevo,** el overlay y el panel recuperan la última alineación guardada en el relay. Si nadie estuvo conectado durante un tiempo, nunca se recupera una alineación "en pantalla" vieja: arranca oculta.
- **Cuota gratuita:** Cloudflare permite 100.000 solicitudes por día en este tipo de servicio, y cada 20 mensajes cuentan como una. Un programa de varias horas usa una fracción mínima. Si se superara, las operaciones fallan hasta las 00:00 UTC.
- **Probarlo en tu computadora:** dentro de `relay/`, `npx wrangler dev` levanta el relay en `http://127.0.0.1:8787`. Abre el panel con `?relay=http://127.0.0.1:8787` al final de la dirección.

## Captura de ventana de Chrome (vMix)

Para tener el panel a **tamaño completo** en una ventana normal de Chrome, y que vMix capture esa ventana y recorte solo el XI. No usa relay ni conexión entre páginas: la gráfica y el panel están en la misma página, `captura.html`.

1. Publica el sitio (por ejemplo en GitHub Pages) y abre `https://TU-USUARIO.github.io/REPO/captura.html` en Chrome. Conviene abrirla en **modo aplicación**, sin pestañas ni barra de direcciones, con un acceso directo a Chrome que termine así (la ruta de `chrome.exe` puede variar):
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=https://TU-USUARIO.github.io/REPO/captura.html --window-size=1920,1080
   ```
2. La página se adapta al tamaño de la ventana: el XI ocupa toda la altura, arriba a la izquierda, y el panel usa el resto (en dos columnas si hay lugar). Arriba del panel figura la **guía de recorte** con las medidas actuales de la ventana y el valor de *Crop X2*, en píxeles reales de pantalla.
3. En vMix: *Add Input → NDI / Desktop Capture → Local Desktop Capture* y elige la ventana de Chrome.
4. En la rueda dentada de la entrada, pestaña **Position**: pon *Crop X2* con el valor de la guía y, si la ventana tiene barra de título, *Crop Y1* con su alto. Ajusta mirando la salida.
5. Al aire con uno de los botones de overlay **1 a 4**. No cambies el tamaño de la ventana después de recortar: cambian las medidas (la guía se actualiza sola si lo haces).

Limitaciones de este modo:

- **Sin transparencia.** Una captura de ventana no tiene canal alfa: se ve la tarjeta con su fondo (blanco por defecto).
- **No hay botón Mostrar/Ocultar.** La gráfica siempre se dibuja completa. Entra y sale con el botón de overlay de vMix.
- **La ventana tiene que estar visible.** Si se minimiza o la tapa otra ventana, vMix captura lo que hay debajo. Sirve mejor con un segundo monitor.
- **En algunos equipos Chrome se captura en negro.** Según los foros de vMix, se soluciona desactivando la aceleración por hardware de Chrome, o capturando la pantalla completa en lugar de la ventana.
- Sin verificar todavía en un vMix real.

## vMix

En una prueba con vMix 29, dos entradas *Web Browser* separadas (una para el panel y otra para el overlay) **no** se conectaron entre sí. Hay dos formas de resolverlo:

- **Relay** (sección anterior): el panel va en un navegador normal y la gráfica en vMix, sin recortes. Es la opción cómoda.
- **Todo en uno**, que no necesita internet: la gráfica y el panel viven en la misma página y no hace falta conectar nada.

**Todo en uno (`todo-en-uno.html`):**

1. Agrega una entrada *Web Browser* con la ruta de `todo-en-uno.html` y tamaño **1600 x 1350**. A la izquierda queda la gráfica (1080 x 1350) y a la derecha el panel. (Con ese tamaño exacto la página mantiene siempre esta geometría. Si la abres en un navegador con una ventana más chica, se adapta sola para que nada quede cortado.)
2. Maneja el panel con el mouse desde la ventana de la entrada o desde el Preview. Para escribir nombres, clic derecho sobre la entrada → *Keyboard Enabled* (mientras esté activo, los atajos de vMix no funcionan).
3. Para el aire, pon la entrada en un canal de *Overlay* y en *Settings → Position* recorta el lado derecho (*Crop X2*) hasta que quede solo la gráfica. Oculta es transparente; entra y sale con el botón del panel.
4. Se maneja desde la computadora donde corre vMix.

Sin verificar en un vMix real: el recorte por overlay y cómo se ve la ventana de la entrada una vez recortada.

## Adaptación a distintos tamaños de pantalla

- **`panel.html`** funciona desde un celular hasta un monitor grande: en pantallas angostas las pestañas se desplazan, los controles se agrandan al usarse con el dedo y los campos usan letra de 16 px para que el iPhone no haga zoom al tocarlos. En pantallas anchas pasa a dos columnas.
- **`overlay.html`** se escala solo para entrar completo en la fuente de OBS o la entrada de vMix, del tamaño que sea.
- **`captura.html`** se adapta siempre al tamaño de la ventana. **`todo-en-uno.html`** lo hace solo cuando la ventana es menor que 1600 x 1350.

## Notas

- Si cambias `panel.html`, regenera `todo-en-uno.html` y `captura.html` con `python tools/generar-paginas.py`.
- El escudo por defecto es genérico y usa los colores de la camiseta. Sube el tuyo en *Diseño*.
- Los datos de ejemplo (nombres y título) reproducen la imagen de referencia. Cámbialos en la pestaña *Alineación*.
- Para probar el overlay en un navegador común: `overlay.html?tablero&demo` (tablero gris para ver la transparencia y una alineación de prueba). Sin esos parámetros el fondo es siempre transparente, en cualquier programa.
- Los nombres o títulos muy largos se condensan solos para no salirse de su lugar.
- La fuente incluida es Archivo (licencia SIL OFL, ver `fonts/LICENSE-Archivo.txt`).

## Archivos

```
panel.html   overlay.html   todo-en-uno.html y captura.html (vMix)   server.js (opcional)
relay/          servicio de Cloudflare que conecta panel y overlay por internet
js/shared.js    lógica común: formaciones, camiseta, dibujo, sincronización
js/panel.js     panel de control
js/config.js    dirección del relay (se completa una vez)
tools/          generar-paginas.py: regenera todo-en-uno.html y captura.html a partir de panel.html
js/overlay.js   recepción y dibujo en OBS
css/            estilos de la gráfica, del panel y del modo todo en uno
fonts/          fuente Archivo en local
```
