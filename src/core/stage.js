/* El escenario: cada sección con data-pose dice dónde va la boca.
   Mientras una sección llena la pantalla, la boca se queda en su pose;
   entre dos secciones se mezcla de una a otra según el scroll.
   x: posición horizontal en pantalla (0 a 1) · dy: subir/bajar (unidades 3D) · s: escala
   rx/ry: inclinación y giro · play: se puede cepillar · book: modo selector de diente */
export const POSES = {
  // m: cuánto se ve la boca · cut: cuánto se ve el molar cortado
  hero:    { x:.53, dy:-.25, s:1.0,  rx:0,   ry:-.16, play:1, book:0, m:1, cut:0, ortho:0, exam:0 },
  care:    { x:.7,  dy:-.15, s:.92,  rx:.06, ry:-.42, play:0, book:0, m:1, cut:0, ortho:0, exam:0 },
  ortho:   { x:.5,  dy:-.75, s:1.32, rx:-.3, ry:0,    play:0, book:0, m:1, cut:0, ortho:1, exam:0 },
  inside:  { x:.66, dy:.2,   s:.4,   rx:0,   ry:-.8,  play:0, book:0, m:0, cut:1, ortho:0, exam:0 },
  visit:   { x:.72, dy:-.2,  s:.98,  rx:.02, ry:.3,   play:0, book:0, m:1, cut:0, ortho:0, exam:1 },
  book:    { x:.27, dy:-.1,  s:.86,  rx:0,   ry:0,    play:0, book:1, m:1, cut:0, ortho:0, exam:0 },
  away:    { x:.5,  dy:7.5,  s:.6,   rx:0,   ry:0,    play:0, book:0, m:1, cut:0, ortho:0, exam:0 },
};
const KEYS = Object.keys(POSES.hero);

export const pose = { ...POSES.hero, index:0 };
let marks = [];   // { start, end, p } en píxeles de documento

export function measure(){
  const vh = innerHeight;
  marks = [...document.querySelectorAll('[data-pose]')].map(el => {
    const r = el.getBoundingClientRect(), top = r.top + scrollY;
    return { start:top, end:Math.max(top, top + r.height - vh), p:POSES[el.dataset.pose] || POSES.away, el };
  });
}
addEventListener('resize', measure);

const smooth = k => k * k * (3 - 2 * k);

/* Pose objetivo para el scroll actual */
export function targetPose(out = {}){
  if (!marks.length) measure();
  const y = scrollY;
  let a = marks[0], b = marks[0], k = 0, idx = 0;
  for (let i = 0; i < marks.length; i++){
    const m = marks[i];
    if (y < m.start){ // entre la anterior y esta
      if (i === 0){ a = b = m; break; }
      a = marks[i - 1]; b = m; idx = i - 1;
      k = smooth(Math.min(1, Math.max(0, (y - a.end) / Math.max(1, b.start - a.end))));
      break;
    }
    a = b = m; idx = i; k = 0;
    if (y <= m.end) break;
  }
  for (const key of KEYS) out[key] = a.p[key] + (b.p[key] - a.p[key]) * k;
  out.index = k > .5 ? idx + 1 : idx;
  return out;
}

export const sections = () => marks.map(m => m.el);
