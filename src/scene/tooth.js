import * as THREE from 'three';

/* Un molar cortado por la mitad, como los modelos de las facultades de odontología.
   La cara del corte son formas planas por capa (esmalte, dentina, pulpa, cemento,
   encía y hueso); detrás, un cuerpo extruido y redondeado da el volumen. */

const V = (x, y) => new THREE.Vector2(x, y);
// mitad derecha del contorno, de la furca (entre raíces) hacia arriba y por la corona
const RIGHT = [V(0, -.72), V(.14, -.86), V(.18, -1.3), V(.2, -1.9), V(.27, -2.36), V(.38, -2.44), V(.5, -2.12),
  V(.6, -1.6), V(.67, -1.0), V(.7, -.4), V(.72, 0), V(.85, .2), V(.92, .5), V(.88, .86), V(.7, 1.14), V(.42, 1.26), V(.18, 1.1), V(0, 1.02)];
const PULP_R = [V(0, .02), V(.2, -.04), V(.33, -.42), V(.37, -1.0), V(.34, -1.6), V(.3, -2.2), V(.33, -2.37), V(.37, -2.2),
  V(.43, -1.6), V(.49, -1.0), V(.5, -.5), V(.44, .1), V(.44, .42), V(.32, .64), V(.18, .46), V(0, .4)];

const mirrorClose = (half) => { const l = half.slice(1, -1).reverse().map(p => V(-p.x, p.y)); return [...half, ...l]; };
function sample(pts, n){
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, p.y, 0)), true, 'centripetal');
  return c.getSpacedPoints(n).slice(0, n).map(p => V(p.x, p.y));
}
function inset(pts, dFn){
  // área con signo para saber hacia dónde queda "adentro"
  let a = 0; for (let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  const s = a > 0 ? 1 : -1;
  return pts.map((p, i) => { const pr = pts[(i - 1 + pts.length) % pts.length], nx = pts[(i + 1) % pts.length];
    const tx = nx.x - pr.x, ty = nx.y - pr.y, L = Math.hypot(tx, ty) || 1; const d = dFn(p);
    return V(p.x + (-ty / L) * d * s, p.y + (tx / L) * d * s); });
}
const shapeOf = pts => new THREE.Shape(pts);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function boneTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#E8D9C0'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++){ const r = 4 + Math.random() * 16; x.beginPath();
    x.ellipse(Math.random() * 512, Math.random() * 512, r, r * (.5 + Math.random() * .6), Math.random() * 3, 0, Math.PI * 2);
    x.fillStyle = `rgba(${170 + Math.random() * 30},${120 + Math.random() * 25},${95 + Math.random() * 20},${.25 + Math.random() * .35})`; x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(.6, .6); return t;
}
function blobTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(46,28,18,1)'); g.addColorStop(.6, 'rgba(70,44,26,.95)'); g.addColorStop(.85, 'rgba(120,84,46,.5)'); g.addColorStop(1, 'rgba(120,84,46,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export const LAYERS = {
  esmalte:  { color:'#F7F3EA', title:'Esmalte', text:'La capa más dura del cuerpo. No tiene nervios ni se regenera: por eso una caries chica se detiene con flúor y limpieza, pero no se "cura" sola.' },
  dentina:  { color:'#EBCF95', title:'Dentina', text:'Más blanda y llena de túbulos que llevan el frío y el dulce al nervio. Cuando la caries llega aquí, el diente empieza a sentirse sensible.' },
  pulpa:    { color:'#DE5F66', title:'Pulpa y nervio', text:'Vasos y nervio dentro de una cámara y conductos. Si se infecta, el tratamiento es una endodoncia.' },
  cemento:  { color:'#D6BC86', title:'Cemento', text:'Cubre la raíz y sostiene las fibras que unen el diente al hueso.' },
  encia:    { color:'#DE858B', title:'Encía', text:'Sella el cuello del diente. Si sangra al cepillarte, la placa ya la está inflamando.' },
  hueso:    { color:'#E3D2B6', title:'Hueso', text:'Sostiene las raíces. Cuando se pierde un diente, este hueso se reabsorbe; un implante lo mantiene.' },
};

export function buildToothSection(){
  const group = new THREE.Group();   // se mueve con la pose
  const inner = new THREE.Group(); group.add(inner); // gira con el mouse
  const outer = sample(mirrorClose(RIGHT), 260);
  const dentin = inset(outer, () => .055);
  // el esmalte solo en la corona y se afina hacia el cuello
  const crownIdx = outer.map((p, i) => p.y > -.02 ? i : -1).filter(i => i >= 0);
  const crown = crownIdx.map(i => outer[i]);
  const crownIn = inset(outer, p => .26 * smooth(-.02, .4, p.y)).filter((p, i) => outer[i].y > -.02);
  const enamel = [...crown, ...crownIn.reverse()];
  const pulp = sample(mirrorClose(PULP_R), 200);

  const faceMats = {}, faces = {};
  const mk = (key, pts, z, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color:LAYERS[key].color, roughness:.62, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-z, polygonOffsetUnits:-z * 4, ...extra });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(pts), 2), m); mesh.position.z = -.002 * z; mesh.renderOrder = 10 + z; inner.add(mesh);
    faceMats[key] = faceMats[key] || []; faceMats[key].push(m); faces[key] = mesh; return mesh;
  };
  // hueso y encía detrás del diente
  const boneTex = boneTexture();
  const bone = [V(-1.9, -.62), V(-1.2, -.5), V(-.72, -.58), V(.72, -.58), V(1.2, -.5), V(1.9, -.62), V(1.95, -3.05), V(-1.95, -3.05)];
  mk('hueso', bone, 1, { map:boneTex, color:'#FFFFFF' });
  const gumR = [V(.73, .2), V(.86, .26), V(1.25, .18), V(1.7, -.05), V(1.92, -.42), V(1.92, -.8), V(.7, -.8), V(.7, -.4)];
  mk('encia', gumR, 2); mk('encia', gumR.map(p => V(-p.x, p.y)).reverse(), 2);
  mk('cemento', outer, 3);
  mk('dentina', dentin, 4);
  mk('esmalte', enamel, 5);
  mk('pulpa', pulp, 6);

  // nervio y vasos saliendo por la punta de cada raíz
  const vessel = (x0, col) => { const pts = [V(x0, -2.3), V(x0 * 1.05, -2.6), V(x0 * 1.35, -2.85), V(x0 * 1.9, -3.02)].map(p => new THREE.Vector3(p.x, p.y, -.016));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .022, 6), new THREE.MeshStandardMaterial({ color:col, roughness:.5 })); inner.add(m); return m; };
  const nerves = [vessel(.33, '#D9534F'), vessel(-.33, '#D9534F'), vessel(.37, '#F2C14E'), vessel(-.37, '#F2C14E')];

  // la caries: una mancha que baja desde el surco de la corona
  const cariesMat = new THREE.MeshBasicMaterial({ map:blobTexture(), transparent:true, side:THREE.DoubleSide, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-8, polygonOffsetUnits:-32 });
  const caries = new THREE.Mesh(new THREE.CircleGeometry(1, 40), cariesMat); caries.position.z = -.02; caries.renderOrder = 20; inner.add(caries);

  // el cuerpo de atrás: se extruye el contorno y se aplana el bisel delantero
  const body = (pts, depth, bev, size, matOpts) => {
    const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth, bevelEnabled:true, bevelThickness:bev, bevelSize:size, bevelOffset:-size, bevelSegments:6, curveSegments:4, steps:1 });
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) p.setZ(i, 0);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ roughness:.35, clearcoat:.5, clearcoatRoughness:.2, ...matOpts })); m.castShadow = true; inner.add(m); return m;
  };
  const tBody = body(outer, .3, .45, .09, { color:'#FFFFFF', vertexColors:true });
  { const g = tBody.geometry, p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color('#F4EFE2'), b = new THREE.Color('#E2CC9A'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++){ c.copy(b).lerp(a, smooth(-.15, .2, p.getY(i))); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  body(bone, .4, .3, .2, { color:'#E8D7BC', roughness:.8, clearcoat:0 });
  body(gumR, .45, .3, .12, { color:'#D9787F', sheen:.5, sheenColor:new THREE.Color('#FFD9DD') });
  body(gumR.map(p => V(-p.x, p.y)).reverse(), .45, .3, .12, { color:'#D9787F', sheen:.5, sheenColor:new THREE.Color('#FFD9DD') });

  // puntos de anclaje para las etiquetas (en coordenadas del corte)
  const anchors = { esmalte:V(-.66, .95), dentina:V(.56, .64), pulpa:V(0, .2), cemento:V(-.66, -1.25), encia:V(1.45, -.25), hueso:V(-1.45, -2.1) };

  let focus = null, level = 0, levelS = 0;
  const _base = {};
  for (const k in faceMats) _base[k] = faceMats[k].map(m => m.color.clone());
  const RED = new THREE.Color('#FF3B3B');
  function setFocus(k){ focus = k; }
  function setCaries(t){ level = t; }
  /* etapa según hasta dónde bajó la mancha */
  function stage(t = level){
    const bottom = 1.01 - .63 * t;
    if (t < .02) return 0; if (bottom > .76) return 1; if (bottom > .5) return 2; if (bottom > .41) return 3; return 4;
  }
  function update(dt, time, yaw, pitch){
    inner.rotation.set(-.05 + pitch, Math.PI + yaw, 0);
    levelS += (level - levelS) * Math.min(1, dt * 10);
    const ry = .02 + .315 * levelS, rx = .06 + .17 * levelS;
    caries.scale.set(rx, ry, 1); caries.position.set(0, 1.05 - ry, -.02); caries.visible = levelS > .015;
    const hot = stage(levelS) === 4 ? .5 + .5 * Math.sin(time * 6) : stage(levelS) === 3 ? .25 : 0;
    for (const k in faceMats) faceMats[k].forEach((m, i) => {
      const on = focus === k, dim = focus && !on;
      m.emissive.copy(_base[k][i]).multiplyScalar(on ? .22 + .1 * Math.sin(time * 5) : 0);
      if (k === 'pulpa' && hot > 0) m.emissive.copy(RED).multiplyScalar(.35 * hot);
      m.color.copy(_base[k][i]).multiplyScalar(dim ? .78 : 1);
    });
    nerves.forEach(n => n.material.emissive.set(hot > 0 ? '#FF2A2A' : '#000000').multiplyScalar(.5 * hot));
  }
  const _p = new THREE.Vector3();
  function anchorWorld(key, out = new THREE.Vector3()){ const a = anchors[key]; return inner.localToWorld(out.set(a.x, a.y, -.03)); }
  return { group, update, setFocus, setCaries, stage, anchorWorld, anchors };
}
