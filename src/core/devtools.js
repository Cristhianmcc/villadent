/* Ayudas de desarrollo: siempre arranca arriba y muestra los errores en pantalla
   (dentro del enlace publicado no hay consola a mano). */
try { history.scrollRestoration = 'manual'; } catch (e) {}
addEventListener('load', () => scrollTo(0, 0));

let box = null;
function show(msg){
  if (!box){
    box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;max-width:min(560px,90vw);max-height:40vh;overflow:auto;margin:0;padding:10px 12px;border-radius:12px;background:#24343A;color:#FFE1E6;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap';
    document.body.appendChild(box);
  }
  box.textContent += msg + '\n';
}
addEventListener('error', e => show('Error: ' + (e.message || e.error) + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '')));
addEventListener('unhandledrejection', e => show('Promesa: ' + (e.reason && e.reason.message || e.reason)));
const ce = console.error.bind(console);
console.error = (...a) => { ce(...a); show(a.map(x => x && x.message || String(x)).join(' ')); };
