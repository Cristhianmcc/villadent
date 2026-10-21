# Dental Villadent

Página web de Dental Villadent (Villa Poeta José Gálvez): servicios, precios y reserva por WhatsApp, con una boca 3D que acompaña cada sección.

## Qué tiene

- **Inicio**: un equipo de odontólogos en miniatura llega caminando y bajando con soga, limpia la placa diente por diente y cura tres caries con su mini taladro. Un odontograma marca cada pieza limpia.
- **De chuecos a derechos**: mueves el mouse y una línea separa los dientes apiñados de los mismos dientes alineados con brackets.
- **Servicios y precios**: al pasar por cada servicio, la boca muestra dónde se trabaja (brackets en ortodoncia, blanqueamiento, piezas con caries...). Al hacer clic se elige en la reserva.
- **Por dentro de un diente**: un molar cortado con esmalte, dentina, pulpa, cemento, encía y hueso. Con el deslizador la caries avanza y te dice qué curación corresponde y su precio.
- **Tu primera visita**: los cuatro pasos.
- **Reserva**: tocas el diente que te molesta en la boca 3D, eliges servicio y paciente, y la página muestra los días y horas libres de verdad (según la agenda de la clínica en Google Calendar). Al agendar te da un código y un botón para enviar la cita por WhatsApp al 987 916 866.

## Conectar la agenda de la clínica

Sigue `apps-script/LEEME.md` (unos 10 minutos con la cuenta de Google de la clínica) y pega la URL en `src/config.js`. Mientras esté vacía, la reserva funciona en modo demostración.

## Cómo verla

- **Doble clic en `Dental Villadent.html`**. Es la página completa en un solo archivo (necesita internet para las fuentes y Three.js).
- Para trabajar en el código: `npm install` y luego `npm run dev`.
- En equipos lentos, agrega `?lite` al final de la dirección: quita la transparencia, las sombras y el reflejo.

## Dónde está cada cosa

| Parte | Archivo |
| --- | --- |
| Textos y secciones | `index.html` |
| Colores y tipografías | `src/styles.css` (bloque `:root`) |
| Dónde va la boca en cada sección | `src/core/stage.js` |
| Boca, placa y modos de cada servicio | `src/scene/mouth.js` |
| Mini odontólogos, escaleras, sogas y espuma | `src/scene/crew.js` |
| Molar cortado | `src/scene/tooth.js` |
| Escena, cámara y juego | `src/scene/scene.js` |
| Servicios, capas, caries y formulario de reserva | `src/page/booking.js` |
| Conexión con la agenda (y modo demostración) | `src/page/agenda.js`, `src/config.js` |
| Servidor de la agenda (Google Apps Script) | `apps-script/` |

Para cambiar precios: edítalos en `index.html` (lista de servicios) y en `VERDICTS` de `src/page/booking.js`.

Después de editar `index.html` o `src/`, vuelve a generar `Dental Villadent.html` con Claude (o usa `npm run build`).
