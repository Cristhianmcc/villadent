/* Habla con la agenda de la clínica: pide horarios libres y agenda citas.
   Sin AGENDA_URL funciona en modo demostración (horarios simulados guardados en este navegador). */
import { AGENDA_URL } from '../config.js';

export const demo = !AGENDA_URL;
const cache = new Map();

export async function getDays(servicio, fresh = false){
  const key = servicio, hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.t < 60000) return hit.days;
  const days = demo ? demoDays(servicio) : await remoteDays(servicio);
  cache.set(key, { t:Date.now(), days }); return days;
}
export async function book(data){
  cache.clear();
  if (demo) return demoBook(data);
  const r = await fetch(AGENDA_URL, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:JSON.stringify({ action:'book', ...data }) });
  return r.json();
}
async function remoteDays(servicio){
  const r = await fetch(`${AGENDA_URL}?action=slots&servicio=${encodeURIComponent(servicio)}`);
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'agenda'); return j.days;
}

/* ── Modo demostración: mismas reglas que el Apps Script, con ocupados al azar (fijos por día) ── */
const HOURS = { 1:[[540, 780], [900, 1140]], 2:[[540, 780], [900, 1140]], 3:[[540, 780], [900, 1140]], 4:[[540, 780], [900, 1140]], 5:[[540, 780], [900, 1140]], 6:[[540, 780]], 0:[] };
const DUR = { 'Evaluación':30, 'Curación simple':30, 'Curación compuesta':45, 'Curación compleja':60, 'Limpieza completa + flúor':45, 'Limpieza + blanqueamiento láser':90, 'Prótesis fija o removible':30, 'Ortodoncia con brackets':30 };
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function store(){ try { return JSON.parse(localStorage.getItem('vd-demo-citas') || '[]'); } catch (e){ return []; } }
function save(list){ try { localStorage.setItem('vd-demo-citas', JSON.stringify(list)); } catch (e){} }
function rand(seed){ let x = seed; return () => (x = (x * 9301 + 49297) % 233280) / 233280; }
function demoBusy(date){
  const r = rand([...date].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 233280), busy = [];
  for (let i = 0; i < 4; i++){ const s = 540 + Math.floor(r() * 20) * 30; busy.push([s, s + (r() < .5 ? 30 : 60)]); }
  for (const c of store()) if (c.fecha === date) busy.push([toMin(c.hora), toMin(c.hora) + c.duracion]);
  return busy;
}
function demoSlots(date, dur){
  const d = new Date(date + 'T12:00:00'), ranges = HOURS[d.getDay()] || [], busy = demoBusy(date);
  const now = new Date(), minStart = date === iso(now) ? now.getHours() * 60 + now.getMinutes() + 120 : -1;
  const out = [];
  for (const [a, b] of ranges) for (let s = a; s + dur <= b; s += 30){ if (s < minStart) continue; if (busy.some(([x, y]) => s < y && s + dur > x)) continue; out.push(hhmm(s)); }
  return out;
}
function demoDays(servicio){
  const dur = DUR[servicio] || 30, out = [], t = new Date();
  for (let i = 0; i < 14; i++){ const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i); const date = iso(d); out.push({ date, slots:demoSlots(date, dur) }); }
  return out;
}
function demoBook(b){
  const dur = DUR[b.servicio] || 30;
  if (!demoSlots(b.fecha, dur).includes(b.hora)) return { ok:false, error:'ocupado' };
  const codigo = 'VD-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const list = store(); list.push({ fecha:b.fecha, hora:b.hora, duracion:dur }); save(list);
  return new Promise(res => setTimeout(() => res({ ok:true, codigo, fecha:b.fecha, hora:b.hora, duracion:dur, servicio:b.servicio, demo:true }), 700));
}
