import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sound } from '../core/sound.js';
import { makeSoftMirror } from './mirror.js';
import { POSES, targetPose } from '../core/stage.js';
import { buildMouth } from './mouth.js';
import { buildCrew } from './crew.js';
import { buildExam } from './exam.js';
import { buildToothSection, LAYERS } from './tooth.js';

/* El escenario fijo: una boca que viaja por las secciones, el cepillo del hero
   y el molar cortado de "Por dentro". */
const $ = s => document.querySelector(s);
const canvas = $('#scene'), fx = $('#fx');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let started = false;
// ?lite: sin transmisión, sombras ni reflejo (para equipos lentos y pruebas)
const LITE = new URLSearchParams(location.search).has('lite');
const SPEED = +(new URLSearchParams(location.search).get('speed') || 1);   // ?speed=3 acelera al equipo (para pruebas)

function gateCheck(){
  const small = innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  document.documentElement.classList.toggle('touch', small);
  if (!started){ started = true; init().catch(err => { console.error(err); document.documentElement.classList.add('no3d'); }); }
}
gateCheck(); addEventListener('resize', gateCheck);

async function init(){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(LITE ? 1 : Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  renderer.autoClear = false;
  renderer.shadowMap.enabled = !LITE; renderer.shadowMap.type = THREE.VSMShadowMap;

  const BG = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#EAF2FA';
  const scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .95;

  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  const camTarget = new THREE.Vector3(0, 1.3, 0);
  camera.position.set(0, 4.7, 12.6); camera.lookAt(camTarget);

  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 7, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdcecff, .9); rim.position.set(-5, 3, -4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc4d8ee, .55));
  const sun = new THREE.DirectionalLight(0xffffff, .45), SUN_OFF = new THREE.Vector3(6.5, 8, 2.2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left:-6.5, right:6.5, top:6.5, bottom:-6.5, near:1, far:26 });
  sun.shadow.radius = 22; sun.shadow.blurSamples = 25; sun.shadow.bias = -.0004;
  scene.add(sun, sun.target);

  const world = new THREE.Group(); scene.add(world);
  const mouth = buildMouth(world);
  const FLOOR = mouth.FLOOR;
  const section = buildToothSection(); scene.add(section.group);

  // piso: sombra suave, contacto y reflejo
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color:'#21416E', opacity:.18 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const mirror = makeSoftMirror(renderer, { size:16, radius:3.4, opacity:.28 }); scene.add(mirror);
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(30,60,100,.5)'); g.addColorStop(.55, 'rgba(30,60,100,.18)'); g.addColorStop(1, 'rgba(30,60,100,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map:shadowTex, transparent:true, depthWrite:false, toneMapped:false }));
  contact.rotation.x = -Math.PI / 2; contact.position.set(0, FLOOR + .002, .1); contact.scale.set(5.4, 4.2, 1); contact.renderOrder = -1; world.add(contact);

  if (LITE){ mirror.visible = false; scene.traverse(o => { const ms = o.material ? [].concat(o.material) : []; ms.forEach(m => { if ('transmission' in m) m.transmission = 0; }); }); }
  /* ── Encuadre ── */
  let W = 1, H = 1;
  const screenX = (x, dist = camera.position.distanceTo(camTarget)) => (x - .5) * 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  function resize(){ W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const P = { ...POSES.hero }, TP = {};
  const intro = { y:reduceMotion ? 0 : 6, v:0, on:!reduceMotion, t:0 };
  const squash = { s:0, v:0 };

  /* ── Puntero ── */
  const ndc = new THREE.Vector2(9, 9), raycaster = new THREE.Raycaster();
  const ptr = { inside:false, x:0, y:0, px:0, py:0, speed:0 };
  let tilt = { x:0, y:0 };
  canvas.addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.inside = true;
    ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1); });
  canvas.addEventListener('pointerleave', () => { ptr.inside = false; ndc.set(9, 9); });
  canvas.addEventListener('pointerdown', e => { Sound.unlock(); ndc.set(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1);
    if (P.book > .5){ const h = pickTooth(); if (h) choose(h.tooth); }
    if (P.play > .5){ raycaster.setFromCamera(ndc, camera); const h = raycaster.intersectObjects(crew.meshes, false)[0]; if (h){ crew.poke(h.object.userData.worker); Sound.boing(); } }
    if (P.exam > .5){ raycaster.setFromCamera(ndc, camera); const h = raycaster.intersectObjects(exam.meshes, false)[0]; if (h){ exam.poke(h.object.userData.examiner); Sound.boing(); } } });
  addEventListener('pointermove', e => { tilt.x = e.clientX / innerWidth - .5; tilt.y = e.clientY / innerHeight - .5; }, { passive:true });

  function pickTooth(){
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(mouth.toothMeshes, false);
    return hits.length ? { tooth:hits[0].object.userData.tooth, hit:hits[0] } : null;
  }

  /* ── Interfaz del hero: odontograma que se llena al limpiar ── */
  const odo = $('#odo'), pct = $('#cleanPct');
  const ORDER = [[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]];
  const cells = {};
  if (odo){ ORDER.forEach((row, r) => { const line = document.createElement('div'); line.className = 'odo-row';
    row.forEach(f => { if (!mouth.teeth.find(t => t.fdi === f)) return; const i = document.createElement('i'); i.title = 'Pieza ' + f; i.dataset.fdi = f; line.appendChild(i); cells[f] = i; });
    odo.appendChild(line); }); }
  const _sv = new THREE.Vector3();
  const toScreen = v => { _sv.copy(v).project(camera); return { x:(_sv.x + 1) / 2 * W, y:(1 - _sv.y) / 2 * H }; };
  function sparkle(x, y, n = 10, colors = ['#4FB6E8', '#FFFFFF', '#F7D23E'], spread = 70){
    for (let i = 0; i < n; i++){ const s = document.createElement('i'); s.className = 'spark';
      const a = Math.random() * Math.PI * 2, d = spread * (.4 + Math.random() * .8);
      s.style.cssText = `left:${x}px;top:${y}px;--c:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--s:${6 + Math.random() * 10}px;--t:${.5 + Math.random() * .5}s`;
      fx.appendChild(s); setTimeout(() => s.remove(), 1100); }
  }
  function onClean(t){
    cells[t.fdi]?.classList.add('on'); Sound.tick();
    const p = toScreen(t.mesh.getWorldPosition(new THREE.Vector3())); sparkle(p.x, p.y, 6);
  }
  /* ── El equipo de mini odontólogos ── */
  const card = $('.clean-card'), cariesN = $('#cariesN');
  const crew = buildCrew(world, mouth, {
    onClean,
    scrubAt:(p, amt) => mouth.scrub(p, amt, onClean),
    onFilled:t => { const p = toScreen(t.mesh.getWorldPosition(new THREE.Vector3())); sparkle(p.x, p.y, 12, ['#C8D1D7', '#FFFFFF', '#F7D23E']); Sound.ding(); },
    drill:on => on ? Sound.drill.start() : Sound.drill.stop(),
    clack:() => Sound.clack(4),
    onStart:() => { card?.classList.remove('done'); Object.values(cells).forEach(c => c.classList.remove('on')); },
    onAllDone:() => { Sound.chime(); card?.classList.add('done');
      const c = toScreen(world.localToWorld(new THREE.Vector3(0, 1.1, .8))); sparkle(c.x, c.y, 34, ['#4FB6E8', '#FFFFFF', '#F7D23E', '#1E63C6'], 220); },
    onFinished:() => card?.classList.add('finished'),
    scrubbing:on => { if (on && !brushing){ Sound.brush.start(); brushing = true; } if (!on && brushing){ Sound.brush.stop(); brushing = false; } },
  });
  let crewStarted = false, brushing = false;
  /* ── Primera visita: el equipo que revisa con linterna, lupa y tablilla ── */
  const tagsEl = $('#tags'), tags = [];
  const exam = buildExam(world, mouth, { tag:(p, text) => { if (!tagsEl) return; const el = document.createElement('span'); el.className = 'tag3d' + (text.warn ? ' warn' : ''); el.textContent = text.text; tagsEl.appendChild(el);
    tags.push({ el, p:p.clone(), t:0 }); Sound.tick(); } });
  $('#againBtn')?.addEventListener('click', () => { card?.classList.remove('finished'); crew.start(); });
  /* ── Reserva: elegir la pieza tocándola ── */
  function choose(t){ mouth.choose(t); squash.v += .4; Sound.tick();
    const p = toScreen(t.mesh.getWorldPosition(new THREE.Vector3())); sparkle(p.x, p.y, 8);
    window.dispatchEvent(new CustomEvent('vd:pieza', { detail:{ fdi:t.fdi, name:t.name } })); }
  window.addEventListener('vd:pieza-off', () => mouth.choose(null));

  /* ── Tratamientos: cada uno enciende su zona de la boca ── */
  window.addEventListener('vd:modo', e => mouth.setMode(e.detail));

  /* ── Por dentro: capas y caries ── */
  window.addEventListener('vd:capa', e => section.setFocus(e.detail));
  window.addEventListener('vd:caries', e => section.setCaries(e.detail));
  window.__vdStage = section.stage;
  const pins = $('#pins'), pinEls = {};
  if (pins) for (const k in LAYERS){ const b = document.createElement('button'); b.type = 'button'; b.className = 'pin'; b.dataset.layer = k;
    b.innerHTML = `<span>${LAYERS[k].title}</span>`; b.addEventListener('click', () => window.dispatchEvent(new CustomEvent('vd:capa-click', { detail:k })));
    pins.appendChild(b); pinEls[k] = b; }

  window.__vd = { mouth, P, camera, crew, exam };
  /* línea del antes / después de ortodoncia */
  const splitEl = document.getElementById('split');
  let splitX = 9, wasOrtho = false, splitDemo = true;
  const _ndc2 = new THREE.Vector2();
  addEventListener('pointermove', () => { if (P.ortho > .55) splitDemo = false; }, { passive:true });
  /* ── Bucle ── */
  let last = performance.now(), time = 0, yaw = 0, pitch = 0;
  const _v = new THREE.Vector3(), camFwd = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
  const plane = new THREE.Plane();
  function frame(now){
    requestAnimationFrame(frame);
    const realDt = Math.min(.5, Math.max(0, (now - last) / 1000)); last = now;
    const dt = Math.min(1 / 30, realDt); if (document.hidden) return; time += dt;

    // entrada: la boca cae y rebota (con tiempo real, para que llegue aunque el equipo vaya lento)
    for (let r = realDt; intro.on && r > 0; r -= 1 / 60){ const h = Math.min(r, 1 / 60); intro.t += h; if (intro.t > .4){ intro.v -= 24 * h; intro.y += intro.v * h;
      if (intro.y <= 0){ intro.y = 0; if (intro.v < -2) squash.v += -intro.v * .35; intro.v = -intro.v * .16; if (Math.abs(intro.v) < .8){ intro.v = 0; intro.on = false; } } } }
    targetPose(TP); { const k = 1 - Math.exp(-realDt * 5.5); for (const key in P) P[key] += (TP[key] - P[key]) * k; }
    squash.v += (-170 * squash.s - 10 * squash.v) * dt; squash.s += squash.v * dt; squash.s = THREE.MathUtils.clamp(squash.s, -.15, .15);

    // inclinación suave hacia el puntero (la boca "mira" al visitante)
    yaw += (tilt.x * .35 * (1 - P.ortho) - yaw) * Math.min(1, dt * 3); pitch += (tilt.y * .12 - pitch) * Math.min(1, dt * 3);
    const fit = THREE.MathUtils.clamp(camera.aspect / 1.7, .55, 1);
    const S = P.s * fit * Math.max(.0001, P.m), baseX = screenX(P.x);
    const floorY = P.dy + FLOOR * S;
    world.visible = P.m > .02;
    world.position.set(baseX, intro.y + P.dy + (1 - P.m) * -1.2, 0);
    world.rotation.set(P.rx + pitch * (P.play > .5 ? .5 : 1), P.ry + yaw * (P.book > .5 ? .3 : 1), 0);
    world.scale.set(S * (1 + squash.s * .5), S * (1 - squash.s), S * (1 + squash.s * .5));
    sun.target.position.set(baseX, P.dy, 0); sun.position.copy(sun.target.position).add(SUN_OFF);
    mirror.position.set(baseX, floorY, 0); floor.position.y = floorY + .001;
    mirror.material.uniforms.opacity.value = .28 * P.m; if (LITE) mirror.visible = false;
    contact.material.opacity = 1 / (1 + intro.y * .25);

    // molar cortado
    const cut = P.cut, cs = Math.max(.0001, cut * fit * 1.02);
    section.group.visible = cut > .02;
    section.group.position.set(screenX(.68), 1.55 + (1 - cut) * -2.5, 0);
    section.group.scale.setScalar(cs);
    section.update(dt, time, -.45 + yaw * 1.4, pitch * .6);

    // reserva: resaltar el diente bajo el puntero
    if (P.book > .5 && ptr.inside){ const h = pickTooth(); mouth.setHover(h ? h.tooth : null); canvas.classList.toggle('pointer', !!h); }
    else { mouth.setHover(null); canvas.classList.toggle('pointer', (P.play > .5 || P.exam > .5) && ptr.inside && (raycaster.setFromCamera(ndc, camera), raycaster.intersectObjects(P.play > .5 ? crew.meshes : exam.meshes, false).length > 0)); }

    // el equipo empieza cuando la boca ya cayó; se pausa fuera del inicio
    const heroOn = P.play > .5;
    if (!crewStarted && !intro.on && heroOn){ crewStarted = true; crew.start(); }
    crew.update(Math.min(.1, realDt) * SPEED, time, heroOn);
    if (!heroOn && brushing){ Sound.brush.stop(); Sound.drill.stop(); brushing = false; }
    if (brushing) Sound.brush.set((n, ct) => { n.g.gain.setTargetAtTime(.05 * (.6 + .4 * Math.sin(time * 34)), ct, .02); });
    exam.update(Math.min(.1, realDt) * SPEED, time, P.exam > .5);
    for (let i = tags.length - 1; i >= 0; i--){ const g = tags[i]; g.t += realDt;
      const q = toScreen(world.localToWorld(_v.copy(g.p))); g.el.style.transform = `translate(${q.x}px,${q.y - 18 - g.t * 16}px) translateX(-50%)`; g.el.style.opacity = Math.min(1, g.t * 6, (2 - g.t) * 3);
      if (g.t > 2 || P.exam < .5){ g.el.remove(); tags.splice(i, 1); } }
    if (heroOn && odo){ pct.textContent = Math.round(mouth.progress() * 100) + '%'; if (cariesN) cariesN.textContent = mouth.cariesLeft(); }

    mouth.setDirtShow(Math.min(1, Math.max(0, (P.play - .5) * 2.5 + .5)));
    mouth.update(dt, time, yaw);

    // etiquetas del molar
    if (pins){ const on = cut > .6; pins.classList.toggle('on', on);
      if (on) for (const k in pinEls){ const p = toScreen(section.anchorWorld(k, _v)); pinEls[k].style.transform = `translate(${p.x}px,${p.y}px)`; } }

    // ortodoncia: el mouse mueve el corte entre "antes" y "con brackets"
    const orthoOn = P.ortho > .55;
    if (orthoOn){
      const fz = world.position.z + 1.1 * S;   // profundidad de la cara de los dientes
      let sx;
      if (splitDemo){ sx = baseX + Math.sin(time * 1.1) * 1.4 * S; }
      else { raycaster.setFromCamera(_ndc2.set(tilt.x * 2, -tilt.y * 2), camera); plane.set(_v.set(0, 0, 1), -fz); raycaster.ray.intersectPlane(plane, _v) ? sx = _v.x : sx = baseX; }
      sx = THREE.MathUtils.clamp(sx, baseX - 2.2 * S, baseX + 2.2 * S);
      splitX += (sx - splitX) * Math.min(1, dt * 14);
      mouth.setSplit(true, splitX);
      if (splitEl){ const top = toScreen(_v.set(splitX, world.position.y + 2.9 * S, fz)), bot = toScreen(_v.set(splitX, world.position.y - .5 * S, fz));
        splitEl.style.transform = `translate(${top.x}px,${top.y}px)`; splitEl.style.height = Math.max(0, bot.y - top.y) + 'px'; }
    } else if (wasOrtho){ mouth.setSplit(false); splitX = baseX + 3 * S; }
    if (splitEl) splitEl.classList.toggle('on', orthoOn);
    wasOrtho = orthoOn;

    renderer.clear();
    if (P.dy < 7) renderer.render(scene, camera);
  }
  requestAnimationFrame(t => { last = t; frame(t); });
}
