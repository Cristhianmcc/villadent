/* Footer: "Villadent" gigante. Las letras suben una a una al llegar y rebotan al pasar el cursor. */
const mega = document.getElementById('mega');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (mega){
  [...'Villadent'].forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true'); mega.appendChild(s); });
  const bounce = s => { s.classList.remove('bounce'); void s.offsetWidth; s.classList.add('bounce'); };
  mega.querySelectorAll('span').forEach(s => { s.addEventListener('pointerenter', () => bounce(s)); s.addEventListener('animationend', e => { if (e.animationName === 'bounce') s.classList.remove('bounce'); }); });
  if (reduce) mega.classList.add('in');
  else new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting){ mega.classList.add('in'); io.disconnect(); } }), { threshold:.35 }).observe(mega);
}
