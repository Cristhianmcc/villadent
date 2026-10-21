# Agenda de citas con Google (Apps Script)

Esto conecta la reserva de la página con el **Google Calendar** de la clínica y una **Hoja de cálculo** donde queda cada cita. Es gratis y vive en la cuenta de Google de la clínica.

## Instalación (una sola vez, unos 10 minutos)

Hazlo con la **cuenta de Google de la clínica** (la del calendario donde deben caer las citas).

1. **Crea la hoja.** Entra a sheets.google.com y crea una hoja en blanco. Llámala "Citas Villadent".
2. **Abre el editor de código.** En la hoja: menú **Extensiones → Apps Script**.
3. **Pega el código.** Borra lo que haya en `Code.gs` y pega todo el contenido de `Code.gs` de esta carpeta. Guarda (ícono del disquete).
4. **Zona horaria.** En el editor, ícono del engranaje (**Configuración del proyecto**): marca "Mostrar el archivo de manifiesto appsscript.json". Vuelve al editor, abre `appsscript.json` y reemplaza su contenido con el de esta carpeta. Guarda.
5. **Prepara la hoja.** Arriba elige la función **configurar** y presiona **Ejecutar**. Google pedirá permisos: acepta (es la propia cuenta de la clínica dando permiso a su propio script). Se crean dos pestañas: **Citas** y **Config**.
6. **Publica.** Botón azul **Implementar → Nueva implementación**. Tipo: **Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   Presiona **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
7. **Conecta la página.** Abre `src/config.js` en la carpeta del proyecto y pega la URL:
   ```js
   export const AGENDA_URL = 'https://script.google.com/macros/s/XXXX/exec';
   ```
   Guarda. Desde ese momento la página deja el modo demostración y agenda de verdad.

## El día a día de la clínica

- **Horario de atención:** se cambia en la pestaña **Config** (por ejemplo `lunes` → `09:00-13:00, 15:00-19:00`). Vacío = cerrado. Los valores que vienen son de ejemplo: **ajústalos con la clínica**.
- **Duración de cada servicio:** filas `dur:...` en **Config**.
- **Bloquear un horario** (almuerzo, una cita por teléfono, un día libre): basta con crear un evento en el Google Calendar. La página ya no ofrece esa hora.
- **Cerrar un día completo:** evento de todo el día con un título que diga "Cerrado", "Feriado" o "Vacaciones".
- **Cancelar una cita:** borra el evento del calendario (la hora vuelve a quedar libre) y en la hoja cambia el Estado a "Cancelada".
- Cada cita trae en su descripción el enlace de WhatsApp del paciente para confirmarle con un clic.

## Cuando cambies el código

Si editas `Code.gs`, vuelve a **Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: nueva → Implementar**. La URL sigue siendo la misma.

## Seguridad y datos

- La página solo puede pedir horarios libres y crear citas; no puede leer las citas de otros pacientes.
- Hay un campo trampa contra robots y un límite de 3 reservas por celular cada 6 horas.
- Se guardan nombre y celular de pacientes: la página pide su consentimiento. Revisen con la clínica el aviso de privacidad (Ley 29733 de Protección de Datos Personales).

## Para el bot de WhatsApp (más adelante)

El bot puede usar esta misma URL: `GET ?action=slots&servicio=...` para ver horarios y `POST {"action":"book", ...}` para agendar. Así la página y el bot comparten la misma agenda.
