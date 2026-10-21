/* Servicios, capas del diente y reserva por WhatsApp.
   Hablan con la escena 3D solo por eventos (vd:modo, vd:capa, vd:caries, vd:pieza). */
import { scrollToEl } from '../core/scroll.js';
import { LAYERS } from '../scene/tooth.js';
import * as agenda from './agenda.js';
import { WHATSAPP } from '../config.js';

const $ = s => document.querySelector(s);
const send = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

/* ── Servicios: al pasar, la boca muestra dónde se trabaja; al hacer clic, se reserva ── */
const menu = $('#menu');
menu?.querySelectorAll('li').forEach(li => {
  li.tabIndex = 0;
  const on = () => { menu.querySelectorAll('li').forEach(x => x.classList.toggle('on', x === li)); send('vd:modo', li.dataset.mode); };
  li.addEventListener('pointerenter', on); li.addEventListener('focus', on);
  li.addEventListener('click', () => { pickChip('serv', li.dataset.serv); scrollToEl($('#reserva')); });
  li.addEventListener('keydown', e => { if (e.key === 'Enter') li.click(); });
});
menu?.addEventListener('pointerleave', () => { menu.querySelectorAll('li').forEach(x => x.classList.remove('on')); send('vd:modo', null); });

// al salir de la sección se apaga el modo
new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) send('vd:modo', null); }), { threshold:.25 }).observe($('#servicios'));

/* ── Capas del diente ── */
const layerText = $('#layerText');
function focusLayer(k){
  document.querySelectorAll('#layers button').forEach(b => { const on = b.dataset.layer === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('.pin').forEach(p => p.classList.toggle('on', p.dataset.layer === k));
  layerText.textContent = LAYERS[k].text; send('vd:capa', k);
}
document.querySelectorAll('#layers button').forEach(b => b.addEventListener('click', () => focusLayer(b.dataset.layer)));
window.addEventListener('vd:capa-click', e => focusLayer(e.detail));

/* ── Caries: el deslizador baja la mancha y dice qué curación toca ── */
const VERDICTS = [
  { t:'Diente sano. Mantenlo así con una limpieza cada seis meses.', s:'Limpieza completa + flúor', p:'S/ 50', layer:null },
  { t:'La caries está en el esmalte. Todavía no duele, pero ya no se va sola.', s:'Curación simple', p:'S/ 25', layer:'esmalte' },
  { t:'Llegó a la dentina. Aquí aparece la sensibilidad al frío y al dulce.', s:'Curación compuesta', p:'S/ 35', layer:'dentina' },
  { t:'Está muy cerca del nervio. Hay que limpiarla a fondo y proteger la pulpa.', s:'Curación compleja', p:'S/ 60', layer:'dentina' },
  { t:'Tocó el nervio. Duele sola, sobre todo de noche. Escríbenos hoy.', s:'Evaluación urgente', p:'Consultar', layer:'pulpa' },
];
const range = $('#cariesRange'), verdict = $('#verdict');
let lastStage = -1;
function onRange(){
  const t = range.value / 100; send('vd:caries', t);
  range.style.setProperty('--v', range.value + '%');
  const st = window.__vdStage ? window.__vdStage(t) : Math.min(4, Math.ceil(t * 4));
  if (st === lastStage) return; lastStage = st;
  const v = VERDICTS[st];
  verdict.dataset.stage = st;
  verdict.querySelector('.v-text').textContent = v.t;
  verdict.querySelector('.v-serv').innerHTML = `<span>${v.s}</span><b>${v.p}</b>`;
}
range?.addEventListener('input', onRange);

/* ── Reserva: horarios libres reales y cita en la agenda de la clínica ── */
const form = $('#bookForm'), nameIn = $('#f-name'), phoneIn = $('#f-phone'), okIn = $('#f-ok'), err = $('#formErr');
const daysEl = $('#days'), slotsEl = $('#slots'), slotsMsg = $('#slotsMsg'), bookBtn = $('#bookBtn');
let pieza = null, days = [], selDate = null, selTime = null, loadId = 0;
if (agenda.demo) $('#demoNote').hidden = false;

function pickChip(name, v){
  const g = form.querySelector(`.chips[data-name="${name}"]`); if (!g) return;
  g.querySelectorAll('.opt').forEach(o => { const on = o.dataset.v === v; o.classList.toggle('on', on); o.setAttribute('aria-checked', on); });
  if (name === 'serv'){ const li = menu?.querySelector(`li[data-serv="${v}"]`); send('vd:modo', li ? li.dataset.mode : null); loadDays(); }
}
form.querySelectorAll('.chips').forEach(g => g.querySelectorAll('.opt').forEach(o => {
  o.setAttribute('role', 'radio'); o.setAttribute('aria-checked', o.classList.contains('on'));
  o.addEventListener('click', () => pickChip(g.dataset.name, o.dataset.v));
}));
const val = name => form.querySelector(`.chips[data-name="${name}"] .opt.on`)?.dataset.v || '';
const asDate = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
const fmtLong = (d, h) => { const s = asDate(d).toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' }); return s[0].toUpperCase() + s.slice(1) + ', ' + fmtHour(h); };
const fmtHour = h => { const [H, M] = h.split(':').map(Number); return `${H > 12 ? H - 12 : H}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`; };

async function loadDays(fresh = false){
  const id = ++loadId; slotsMsg.textContent = 'Buscando horarios libres…'; slotsMsg.hidden = false; slotsEl.innerHTML = ''; form.classList.add('loading');
  try { days = await agenda.getDays(val('serv'), fresh); }
  catch (e){ if (id !== loadId) return; form.classList.remove('loading'); daysEl.innerHTML = ''; slotsMsg.innerHTML = `No pudimos ver la agenda ahora. Escríbenos por <a href="https://wa.me/${WHATSAPP}">WhatsApp</a> y te damos un horario.`; return; }
  if (id !== loadId) return; form.classList.remove('loading');
  if (!days.some(d => d.date === selDate && d.slots.length)) selDate = (days.find(d => d.slots.length) || {}).date || null;
  renderDays(); renderSlots();
}
function renderDays(){
  daysEl.innerHTML = '';
  for (const d of days){
    const dt = asDate(d.date), b = document.createElement('button'); b.type = 'button'; b.className = 'day' + (d.date === selDate ? ' on' : '');
    b.disabled = !d.slots.length; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', d.date === selDate);
    b.innerHTML = `<small>${dt.toLocaleDateString('es-PE', { weekday:'short' }).replace('.', '')}</small><b>${dt.getDate()}</b><small>${dt.toLocaleDateString('es-PE', { month:'short' }).replace('.', '')}</small>`;
    b.setAttribute('aria-label', dt.toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' }) + (d.slots.length ? '' : ', sin horarios'));
    b.addEventListener('click', () => { selDate = d.date; selTime = null; renderDays(); renderSlots(); });
    daysEl.appendChild(b);
  }
  daysEl.querySelector('.day.on')?.scrollIntoView({ block:'nearest', inline:'nearest' });
}
function renderSlots(){
  slotsEl.innerHTML = '';
  const d = days.find(x => x.date === selDate);
  if (!d){ slotsMsg.textContent = 'No hay horarios libres en los próximos días. Escríbenos por WhatsApp.'; slotsMsg.hidden = false; return; }
  if (!d.slots.includes(selTime)) selTime = null;
  slotsMsg.hidden = true;
  let part = '';
  for (const h of d.slots){
    const p = +h.slice(0, 2) < 13 ? 'Mañana' : 'Tarde';
    if (p !== part){ part = p; const l = document.createElement('span'); l.className = 'part'; l.textContent = p; slotsEl.appendChild(l); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'slot' + (h === selTime ? ' on' : ''); b.textContent = fmtHour(h);
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', h === selTime);
    b.addEventListener('click', () => { selTime = h; err.textContent = ''; renderSlots(); });
    slotsEl.appendChild(b);
  }
}

window.addEventListener('vd:pieza', e => {
  pieza = e.detail;
  $('#picked').innerHTML = `<b>Pieza ${pieza.fdi}</b> ${pieza.name} <button type="button" class="link" id="unpick">Quitar</button>`;
  $('#unpick').addEventListener('click', () => { pieza = null; send('vd:pieza-off'); $('#picked').textContent = 'Tócalo en la boca. Si no sabes cuál es, sigue sin elegir.'; });
});
[nameIn, phoneIn, okIn].forEach(i => i.addEventListener('input', () => { err.textContent = ''; }));

let last = null;
form.addEventListener('submit', async e => {
  e.preventDefault();
  const celular = phoneIn.value.replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  if (!selDate || !selTime){ err.textContent = 'Elige el día y la hora de tu cita.'; return; }
  if (!nameIn.value.trim()){ err.textContent = 'Escribe tu nombre.'; nameIn.focus(); return; }
  if (!/^9\d{8}$/.test(celular)){ err.textContent = 'Escribe tu celular de 9 dígitos (empieza con 9).'; phoneIn.focus(); return; }
  if (!okIn.checked){ err.textContent = 'Marca la casilla para que la clínica pueda usar tus datos.'; okIn.focus(); return; }
  const data = { servicio:val('serv'), paciente:val('who'), pieza:pieza ? `${pieza.fdi} (${pieza.name})` : '', fecha:selDate, hora:selTime,
    nombre:nameIn.value.trim(), celular, consentimiento:true, web:$('#f-web').value };
  bookBtn.disabled = true; bookBtn.textContent = 'Agendando…';
  let r; try { r = await agenda.book(data); } catch (x){ r = { ok:false, error:'red' }; }
  bookBtn.disabled = false; bookBtn.textContent = 'Agendar cita';
  if (!r.ok){
    if (r.error === 'ocupado'){ err.textContent = 'Esa hora se acaba de ocupar. Elige otra, por favor.'; selTime = null; loadDays(true); }
    else if (r.error === 'limite') err.textContent = 'Ya agendaste varias citas con este celular. Escríbenos por WhatsApp.';
    else if (r.error === 'datos') err.textContent = 'Revisa tus datos e inténtalo otra vez.';
    else err.textContent = 'No pudimos agendar ahora. Inténtalo de nuevo o escríbenos por WhatsApp.';
    return;
  }
  last = { ...data, ...r }; showDone(last);
});
function waText(c){
  return ['Hola Dental Villadent, agendé una cita desde la página web.', `Código: ${c.codigo}`, `Servicio: ${c.servicio}`, `Día: ${fmtLong(c.fecha, c.hora)}`,
    `Paciente: ${c.paciente}`, c.pieza ? `Pieza: ${c.pieza}` : null, `Nombre: ${c.nombre}`, `Celular: ${c.celular}`].filter(Boolean).join('\n');
}
function showDone(c){
  $('#dnWhen').textContent = fmtLong(c.fecha, c.hora);
  $('#dnServ').textContent = c.servicio; $('#dnWho').textContent = c.paciente; $('#dnTooth').textContent = c.pieza || 'Sin elegir';
  $('#dnName').textContent = c.nombre; $('#dnCode').textContent = c.codigo + (c.demo ? ' (demostración)' : '');
  $('#waBtn').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(waText(c))}`;
  form.hidden = true; $('#done').hidden = false; $('#done').classList.remove('pop'); void $('#done').offsetWidth; $('#done').classList.add('pop');
}
$('#againBook').addEventListener('click', () => { $('#done').hidden = true; form.hidden = false; selTime = null; loadDays(true); });

// carga los horarios cuando la sección se acerca (no antes, para no gastar)
new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting){ loadDays(); io.disconnect(); } }), { rootMargin:'400px' }).observe($('#reserva'));

// botones que ya traen un servicio elegido (p. ej. "Reservar evaluación" de ortodoncia)
document.querySelectorAll('a[data-serv]').forEach(a => a.addEventListener('click', () => pickChip('serv', a.dataset.serv)));
