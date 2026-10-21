# Dental Villadent: reglas del proyecto

## Qué es

Sitio web para Dental Villadent, clínica dental real en Villa Poeta José Gálvez (Paradero 9). Cris lo hace para ofrecérselo a la clínica. Basado en la técnica de Dulcident (carpeta hermana `dulcident`), pero serio: nada de gomitas ni frases de caricatura.

## Datos de la clínica (del volante)

- WhatsApp 987 916 866 · Mz. 74 Lote 6, Parcela "B", Pj. Villa Poeta José Gálvez, Paradero 9 · Atención a niños y adultos · Lema: "¡No dejes de sonreír!"
- Curación simple S/ 25 · compuesta S/ 35 · compleja S/ 60 · Limpieza completa + flúor S/ 50 · Limpieza + blanqueamiento láser S/ 150 · Prótesis fijas y removibles (consultar) · Ortodoncia brackets S/ 100 al mes. Eran precios "solo por este mes": confirmar con la clínica.
- No inventar datos (horarios, doctores, reseñas). Si falta algo, preguntar.

## Técnica

- Módulos ES en `src/`, sin build (importmap a jsDelivr) o con Vite. Toda librería nueva va en `package.json` y en el importmap.
- `Dental Villadent.html` es el sitio en un solo archivo (módulos como data: URLs en el importmap, CSS en línea) para abrir con doble clic. Regenerarlo tras cada cambio.
- Lienzo 3D fijo detrás de todo; cada sección tiene `data-pose` y `src/core/stage.js` dice dónde va la boca (`m`) o el molar cortado (`cut`).
- La placa es un valor por vértice en cada diente (`mouth.js`). En el inicio la limpia un equipo de 4 mini odontólogos (`crew.js`): dos suben por escaleras y caminan por la encía de abajo, dos bajan con soga frente a los dientes de arriba; taladran y rellenan las 3 caries (46, 36, 21). Cada uno sigue un guion escrito como generador. `?speed=3` los acelera para probar.
- En "Tu primera visita" otro equipo (`exam.js`) revisa la boca: linterna sobre los dientes de arriba, lupa parado en la lengua y tablilla; al revisar cada pieza sale una etiqueta con el nombre del diente ("Incisivo central superior izquierdo ✓", o "...: caries" si quedó alguna).
- Las secciones hablan con la escena por eventos: `vd:modo`, `vd:capa`, `vd:caries`, `vd:pieza`.
- Ortodoncia (`data-pose="ortho"`): dos juegos de dientes, los chuecos (`CROOK` en `mouth.js`) y los derechos con brackets; dos planos de corte verticales los separan y el mouse mueve el corte.
- Reserva: `src/page/agenda.js` pide horarios libres y agenda contra un Google Apps Script (`apps-script/Code.gs`: hoja "Citas" + "Config" y el Google Calendar de la clínica, con candado para no duplicar). La URL va en `src/config.js` (`AGENDA_URL`); vacía = modo demostración con horarios simulados. Después de agendar, botón de WhatsApp con el resumen y el código. El horario de atención de `Config` es de ejemplo: confirmarlo con la clínica.
- `?lite` en la URL apaga transmisión, sombras y reflejo.

## Identidad

- Azul noche `#0F2A4A` (marco), celeste pálido `#EAF2FA` (fondo), tinta `#0F2542`, azul `#1E63C6`, celeste `#4FB6E8`, amarillo `#F7D23E` solo para la promo, verde WhatsApp `#128C4A`.
- Bricolage Grotesque para titulares y precios; Hanken Grotesk para el texto.
- Textos en español, cercanos y claros, sin tecnicismos innecesarios.
