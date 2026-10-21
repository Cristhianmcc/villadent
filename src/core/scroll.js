/* Scroll suave con Lenis (si carga) y flecha de "siguiente sección" en la muesca de abajo */
import { measure, sections } from './stage.js';

let lenis = null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function startScroll(){
  if (!reduce){
    try {
      const { default: Lenis } = await import('lenis');
      lenis = new Lenis({ lerp:.09, wheelMultiplier:.9, anchors:true });
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    } catch (e){ console.warn('Lenis no cargó; uso el scroll nativo', e); }
  }
  measure();
  // las fuentes y el 3D cambian alturas: volver a medir
  document.fonts?.ready.then(measure);
  new ResizeObserver(measure).observe(document.body);
}

export function scrollToEl(el){
  if (lenis) lenis.scrollTo(el, { duration:1.4 });
  else el.scrollIntoView({ behavior:reduce ? 'auto' : 'smooth' });
}

// flecha: baja a la siguiente sección; en la última, sube al inicio
const next = document.getElementById('nextBtn');
function nextTarget(){
  const secs = sections(), y = scrollY + 10;
  return secs.find(s => s.getBoundingClientRect().top + scrollY > y + 40) || null;
}
next?.addEventListener('click', () => { const t = nextTarget(); scrollToEl(t || document.getElementById('inicio')); });
addEventListener('scroll', () => { next?.classList.toggle('up', !nextTarget()); }, { passive:true });

// enlaces internos (#como, #inicio...) con el mismo scroll suave
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  const t = document.querySelector(a.getAttribute('href')); if (!t) return;
  e.preventDefault(); scrollToEl(t);
});
