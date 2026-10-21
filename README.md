# Dental Villadent

Página web de Dental Villadent (Villa Poeta José Gálvez): servicios, precios y reserva por WhatsApp, con una boca 3D que acompaña cada sección.

## Qué tiene

- **Inicio**: un equipo de odontólogos en miniatura llega caminando y bajando con soga, limpia la placa diente por diente y cura tres caries con su mini taladro. Un odontograma marca cada pieza limpia.
- **De chuecos a derechos**: mueves el mouse y una línea separa los dientes apiñados de los mismos dientes alineados con brackets.
- **Servicios y precios**: al pasar por cada servicio, la boca muestra dónde se trabaja (brackets en ortodoncia, blanqueamiento, piezas con caries...). Al hacer clic se elige en la reserva.
- **Por dentro de un diente**: un molar cortado con esmalte, dentina, pulpa, cemento, encía y hueso. Con el deslizador la caries avanza y te dice qué curación corresponde y su precio.
- **Tu primera visita**: los cuatro pasos.
- **Reserva**: tocas el diente que te molesta en la boca 3D, eliges servicio, paciente, turno y día, y se abre WhatsApp al 987 916 866 con el mensaje listo.

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
| Servicios, capas, caries y WhatsApp | `src/page/booking.js` |

Para cambiar precios: edítalos en `index.html` (lista de servicios) y en `VERDICTS` de `src/page/booking.js`.

Después de editar `index.html` o `src/`, vuelve a generar `Dental Villadent.html` con Claude (o usa `npm run build`).
# villadent
