/**
 * Dental Villadent · Agenda de citas
 * Servidor gratuito en Google Apps Script. Usa:
 *   - una Hoja de cálculo como base de datos (pestañas "Citas" y "Config"),
 *   - el Google Calendar de la clínica como agenda real.
 *
 * La página pide los horarios libres (GET ?action=slots) y agenda (POST action=book).
 * Un horario está libre si cae dentro del horario de atención y no choca con ningún
 * evento del calendario (también los que la clínica anote a mano).
 *
 * Instalación: ver LEEME.md en esta misma carpeta.
 */

const TZ = 'America/Lima';
const SHEET_CITAS = 'Citas';
const SHEET_CONFIG = 'Config';
const HEADERS = ['Creado', 'Código', 'Fecha', 'Hora', 'Duración (min)', 'Servicio', 'Paciente', 'Pieza', 'Nombre', 'Celular', 'Estado', 'Evento', 'Origen'];

// Valores iniciales: AJUSTAR CON LA CLÍNICA en la pestaña "Config" (no hace falta tocar el código).
const DEFAULT_CONFIG = [
  ['lunes', '09:00-13:00, 15:00-19:00', 'Rangos de atención separados por coma. Vacío = cerrado.'],
  ['martes', '09:00-13:00, 15:00-19:00', ''],
  ['miercoles', '09:00-13:00, 15:00-19:00', ''],
  ['jueves', '09:00-13:00, 15:00-19:00', ''],
  ['viernes', '09:00-13:00, 15:00-19:00', ''],
  ['sabado', '09:00-13:00', ''],
  ['domingo', '', ''],
  ['intervalo_min', 30, 'Cada cuántos minutos empieza un turno.'],
  ['anticipacion_horas', 2, 'No se puede reservar con menos de estas horas.'],
  ['dias', 14, 'Cuántos días hacia adelante se muestran.'],
  ['calendario_id', '', 'Vacío = calendario principal de esta cuenta.'],
  ['dur:Evaluación', 30, 'Minutos que dura cada servicio.'],
  ['dur:Curación simple', 30, ''],
  ['dur:Curación compuesta', 45, ''],
  ['dur:Curación compleja', 60, ''],
  ['dur:Limpieza completa + flúor', 45, ''],
  ['dur:Limpieza + blanqueamiento láser', 90, ''],
  ['dur:Prótesis fija o removible', 30, ''],
  ['dur:Ortodoncia con brackets', 30, ''],
];
const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/* ───────────── Instalación: ejecutar una vez desde el editor ───────────── */
function configurar(){
  const ss = SpreadsheetApp.getActive();
  let citas = ss.getSheetByName(SHEET_CITAS);
  if (!citas){ citas = ss.insertSheet(SHEET_CITAS); citas.appendRow(HEADERS); citas.setFrozenRows(1); citas.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold'); }
  let cfg = ss.getSheetByName(SHEET_CONFIG);
  if (!cfg){ cfg = ss.insertSheet(SHEET_CONFIG); cfg.appendRow(['Clave', 'Valor', 'Nota']); cfg.getRange(2, 1, DEFAULT_CONFIG.length, 3).setValues(DEFAULT_CONFIG); cfg.setFrozenRows(1); cfg.getRange(1, 1, 1, 3).setFontWeight('bold'); }
  getCalendar_();   // pide el permiso del calendario en la primera ejecución
  Logger.log('Listo. Ahora: Implementar > Nueva implementación > Aplicación web.');
}

/* ───────────── API ───────────── */
function doGet(e){
  try {
    const p = e && e.parameter || {};
    if (p.action === 'slots') return json_({ ok:true, tz:TZ, days:availability_(p.servicio) });
    return json_({ ok:true, servicio:'Dental Villadent · agenda' });
  } catch (err){ return json_({ ok:false, error:'servidor', detalle:String(err) }); }
}

function doPost(e){
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'book') return json_(book_(body));
    return json_({ ok:false, error:'accion' });
  } catch (err){ return json_({ ok:false, error:'servidor', detalle:String(err) }); }
}

/* ───────────── Horarios libres ───────────── */
function availability_(servicio){
  const cfg = readConfig_(), dur = durationOf_(cfg, servicio), out = [];
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  for (let i = 0; i < cfg.dias; i++){
    const date = addDays_(today, i);
    out.push({ date, slots:freeSlots_(cfg, date, dur) });
  }
  return out;
}

function freeSlots_(cfg, date, dur){
  const ranges = rangesFor_(cfg, date);
  if (!ranges.length) return [];
  const busy = busyFor_(cfg, date);
  if (busy === 'cerrado') return [];
  const nowMin = minutesFromNow_(date) + cfg.anticipacion_horas * 60;   // en minutos del día; negativo si es otro día
  return computeSlots(ranges, busy, dur, cfg.intervalo_min, nowMin);
}

/** Lógica pura (se puede probar sola): turnos que caben en el horario sin chocar con lo ocupado. */
function computeSlots(ranges, busy, dur, step, minStart){
  const slots = [];
  for (const [a, b] of ranges){
    for (let s = a; s + dur <= b; s += step){
      if (s < minStart) continue;
      const e = s + dur;
      if (busy.some(([x, y]) => s < y && e > x)) continue;
      slots.push(hhmm_(s));
    }
  }
  return slots;
}

function busyFor_(cfg, date){
  const cal = getCalendar_(), start = parseLocal_(date, '00:00'), end = parseLocal_(addDays_(date, 1), '00:00');
  const busy = [];
  for (const ev of cal.getEvents(start, end)){
    if (ev.isAllDayEvent()){
      if (/cerrad|feriad|vacaci|no atiende/i.test(ev.getTitle())) return 'cerrado';
      continue;
    }
    if (ev.getMyStatus && ev.getMyStatus() === CalendarApp.GuestStatus.NO) continue;
    const s = clampToDay_(ev.getStartTime(), date, 0), e = clampToDay_(ev.getEndTime(), date, 24 * 60);
    if (e > s) busy.push([s, e]);
  }
  return busy;
}

/* ───────────── Agendar ───────────── */
function book_(b){
  if (b.web) return { ok:false, error:'datos' };   // campo trampa para robots
  const nombre = String(b.nombre || '').trim().slice(0, 80), celular = String(b.celular || '').replace(/\D/g, '');
  const fecha = String(b.fecha || ''), hora = String(b.hora || ''), servicio = String(b.servicio || 'Evaluación').slice(0, 60);
  if (!nombre || !/^9\d{8}$/.test(celular) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora) || b.consentimiento !== true)
    return { ok:false, error:'datos' };
  // máximo 3 reservas por celular cada 6 horas
  const cache = CacheService.getScriptCache(), key = 'n:' + celular, n = +(cache.get(key) || 0);
  if (n >= 3) return { ok:false, error:'limite' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok:false, error:'ocupado' };
  try {
    const cfg = readConfig_(), dur = durationOf_(cfg, servicio);
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    if (fecha < today || fecha > addDays_(today, cfg.dias)) return { ok:false, error:'fecha' };
    // se vuelve a revisar con el candado puesto: nadie más puede tomar esta hora mientras tanto
    if (freeSlots_(cfg, fecha, dur).indexOf(hora) < 0) return { ok:false, error:'ocupado' };

    const codigo = 'VD-' + Utilities.getUuid().replace(/-/g, '').slice(0, 5).toUpperCase();
    const start = parseLocal_(fecha, hora), end = new Date(start.getTime() + dur * 60000);
    const paciente = String(b.paciente || 'Adulto').slice(0, 20), pieza = String(b.pieza || '').slice(0, 80);
    const desc = [
      'Código: ' + codigo, 'Servicio: ' + servicio, 'Paciente: ' + paciente,
      pieza ? 'Pieza: ' + pieza : null, 'Nombre: ' + nombre, 'Celular: ' + celular,
      'WhatsApp: https://wa.me/51' + celular, 'Agendada desde la página web.',
    ].filter(Boolean).join('\n');
    const ev = getCalendar_().createEvent(servicio + ' · ' + nombre, start, end, { description:desc });
    try { ev.setColor(CalendarApp.EventColor.CYAN); ev.setTag('villadent', codigo); } catch (e){}
    SpreadsheetApp.getActive().getSheetByName(SHEET_CITAS).appendRow([
      new Date(), codigo, fecha, hora, dur, servicio, paciente, pieza, nombre, "'" + celular, 'Pendiente', ev.getId(), 'web',
    ]);
    cache.put(key, String(n + 1), 6 * 3600);
    return { ok:true, codigo, fecha, hora, duracion:dur, servicio };
  } finally { lock.releaseLock(); }
}

/* ───────────── Ayudas ───────────── */
function readConfig_(){
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_CONFIG);
  const rows = sh ? sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 2).getValues() : DEFAULT_CONFIG;
  const m = {}; rows.forEach(r => { if (r[0] !== '') m[String(r[0]).trim()] = r[1]; });
  return { raw:m, intervalo_min:+m.intervalo_min || 30, anticipacion_horas:+m.anticipacion_horas || 0, dias:Math.min(60, +m.dias || 14), calendario_id:String(m.calendario_id || '') };
}
function durationOf_(cfg, servicio){ return +cfg.raw['dur:' + servicio] || +cfg.raw['dur:Evaluación'] || 30; }
function rangesFor_(cfg, date){
  const [y, mo, d] = date.split('-').map(Number), dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return String(cfg.raw[DAY_KEYS[dow]] || '').split(',').map(s => s.trim()).filter(Boolean).map(r => {
    const [a, b] = r.split('-').map(s => toMin_(s.trim())); return [a, b]; }).filter(([a, b]) => b > a);
}
function getCalendar_(){
  const id = readConfigSafe_();
  return id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
}
function readConfigSafe_(){ try { return readConfig_().calendario_id; } catch (e){ return ''; } }
function toMin_(s){ const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); }
function hhmm_(m){ return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
function addDays_(date, n){ const [y, m, d] = date.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); }
function parseLocal_(date, hora){ return Utilities.parseDate(date + ' ' + hora, TZ, 'yyyy-MM-dd HH:mm'); }
function clampToDay_(dt, date, fallback){
  const d = Utilities.formatDate(dt, TZ, 'yyyy-MM-dd');
  if (d < date) return 0; if (d > date) return 24 * 60;
  return toMin_(Utilities.formatDate(dt, TZ, 'HH:mm'));
}
function minutesFromNow_(date){
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (date > today) return -1e9; if (date < today) return 1e9;
  return toMin_(Utilities.formatDate(new Date(), TZ, 'HH:mm'));
}
function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
