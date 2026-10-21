// Punto de entrada
import './core/devtools.js';
import './page/booking.js';
import './page/footer.js';
import './scene/scene.js';
import { startScroll } from './core/scroll.js';
import { Sound } from './core/sound.js';
startScroll();

const snd = document.getElementById('soundBtn');
snd?.addEventListener('click', () => { Sound.unlock(); const m = !Sound.muted; Sound.setMuted(m); snd.setAttribute('aria-pressed', String(!m)); });
