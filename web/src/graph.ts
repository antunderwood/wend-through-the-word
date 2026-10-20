// The graph module: draws a Scene with three.js. No Svelte import, so the scene can be used and
// tested apart from the panels (PRD 10.3 rule 1). Each view only places nodes and sets up the
// camera, controls, and decoration.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { TYPE_PLURAL, type Id, type NodeType, type Role, type Scene, type SceneEdge, type SceneNode, type View } from "./model";
import { viewA } from "./views/a";
import { viewB } from "./views/b";
import { viewC } from "./views/c";
import { layout, type ViewModule } from "./views/view";
import "./graph.css";

// The tilted plane (the default, decision 118), stacked discs, and free orbit.
export const VIEWS: Record<View, ViewModule> = { A: viewA, B: viewB, C: viewC };
const DOUBLE_CLICK_MS = 400,
  MOVE_MS = 700;

const BG = 0x0d0f17,
  ACCENT = 0xffd27a,
  SHARED = 0x4ff0e0,
  PIN = 0xff9f6e;
export const TYPE_COLOUR: Record<NodeType, number> = {
  person: 0x6fa8dc,
  place: 0x6cc4a1,
  event: 0xe6b85c,
  group: 0xb48ee0,
  theme: 0xe0869b,
  verse: 0xa9b1c6,
};
const STYLE: Record<Role, { size: number; opacity: number; labelled: boolean }> = {
  focus: { size: 4.2, opacity: 1, labelled: true },
  ring1: { size: 2.0, opacity: 0.95, labelled: true },
  pinned: { size: 2.6, opacity: 1, labelled: true },
  overflow: { size: 1.8, opacity: 0.75, labelled: true },
  pinring: { size: 1.3, opacity: 0.8, labelled: true },
  path: { size: 1.5, opacity: 0.45, labelled: false },
  ring2: { size: 0.8, opacity: 0.32, labelled: false },
};
const EDGE: Record<SceneEdge["kind"], { color: number; opacity: number }> = {
  focus: { color: 0xc8cde0, opacity: 0.55 },
  overflow: { color: 0x8a90a8, opacity: 0.25 },
  path: { color: ACCENT, opacity: 0.5 },
  pin: { color: PIN, opacity: 0.4 },
  ring2: { color: 0x8a90a8, opacity: 0.14 },
};
// Draw order. Lines (edges, grids, the axis) are 0. Node sprites ignore depth and draw after every
// line, so no line crosses a node: a background coloured mask fills the gap inside a ring, then the
// disc, then the ring.
const LAYER = { glow: 1, mask: 2, disc: 3, ring: 4 };
// The drawn circle's radius as a share of the sprite size: the disc is radius 58 of 128 px; a ring
// stroke ends at 58.5 of 128 px. A Shared or Pinned ring is 1.5 times the node, a Selected one 1.8.
const DISC_RIM = 58 / 128,
  RING_RIM = 58.5 / 128,
  RINGED = 1.5,
  SELECTED = 1.8;
// Labels show in full up to NEAR from the camera and fade out by FAR (PRD 10.4 node look 4).
const NEAR = 170,
  FAR = 230;
const SEG = 12; // segments in a curved edge

function canvasTex(paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  paint(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const disc = (g: CanvasRenderingContext2D) => {
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
};
// A white disc with a dark letter, tinted by the sprite colour: one icon per type.
const discWith = (text: string) =>
  canvasTex((g) => {
    disc(g);
    g.fillStyle = "rgba(0,0,0,0.55)";
    g.font = "bold 56px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 64, 68);
  });
function textures() {
  return {
    type: {
      person: discWith("P"),
      place: discWith("L"),
      event: discWith("E"),
      group: discWith("G"),
      theme: discWith("T"),
      verse: discWith("V"),
    } satisfies Record<NodeType, THREE.Texture>,
    plus: discWith("+"),
    mask: canvasTex(disc),
    ring: canvasTex((g) => {
      g.strokeStyle = "#fff";
      g.lineWidth = 9;
      g.beginPath();
      g.arc(64, 64, 54, 0, Math.PI * 2);
      g.stroke();
    }),
    glow: canvasTex((g) => {
      const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, "rgba(255,255,255,0.8)");
      r.addColorStop(0.35, "rgba(255,255,255,0.25)");
      r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    }),
  };
}

// A camera facing sprite; scale is relative to its parent node.
function sprite(map: THREE.Texture, color: number, opacity: number, scale: number, layer: number, blending: THREE.Blending = THREE.NormalBlending) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthTest: false, depthWrite: false, blending }));
  s.scale.setScalar(scale);
  s.renderOrder = layer;
  s.userData.opacity = opacity;
  return s;
}

type Drawn = { e: SceneEdge; a: THREE.Sprite; b: THREE.Sprite; line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; lab?: CSS2DObject };

export type Graph = ReturnType<typeof createGraph>;

// label(id) names a node; quote(id) is a loaded node's short text (a Verse's BSB quote, an
// Entity's first line of its Dictionary Entry), else "". Throws when the browser has no WebGL.
export function createGraph(host: HTMLElement, label: (id: Id) => string, quote: (id: Id) => string) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = "labels";
  host.appendChild(labels.domElement);
  // A wheel over a name still zooms the scene.
  labels.domElement.addEventListener("wheel", (e) => renderer.domElement.dispatchEvent(new WheelEvent(e.type, e)), { passive: true });

  const scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1000);
  const world = new THREE.Group();
  scene3.add(world);
  const pa = new THREE.Vector3(),
    pb = new THREE.Vector3();
  const TEX = textures();
  // The white ring of the Selected Node, moved from node to node.
  const selRing = new THREE.Group().add(sprite(TEX.mask, BG, 1, SELECTED, LAYER.mask), sprite(TEX.ring, 0xffffff, 1, SELECTED, LAYER.ring));
  // The edge from a hovered Ring 2 node to its parent, at full opacity over the faint ones.
  const hoverEdge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pa, pb]), new THREE.LineBasicMaterial({ color: EDGE.ring2.color }));
  hoverEdge.frustumCulled = false;
  scene3.add(hoverEdge);

  // Test page switches (#30): the Focus glow, the free orbit fog, and a turning camera.
  let look = { glow: true, fog: true, spin: false };
  let view = VIEWS.A,
    controls: OrbitControls,
    deco: THREE.Object3D;
  let drawn: { scene: Scene; selected: Id } | null = null;
  let sprites = new Map<Id, THREE.Sprite>();
  let edges: Drawn[] = [];
  let faint: { line: THREE.LineSegments; pairs: THREE.Sprite[][] } | null = null; // Ring 2 edges, one draw call
  let fading: { el: HTMLElement; obj: THREE.Object3D }[] = [];

  function resize() {
    const { clientWidth: w, clientHeight: h } = host;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  function useView(v: ViewModule) {
    controls?.dispose();
    if (deco) {
      scene3.remove(deco);
      deco.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    view = v;
    scene3.fog = view.fog && look.fog ? new THREE.Fog(BG) : null; // depth fog in free orbit
    camera.position.set(0, 0, 0);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    view.setup(camera, controls);
    controls.autoRotate = look.spin;
    camera.position.add(centre);
    controls.target.add(centre);
    controls.update();
    controls.addEventListener("change", () => follow()); // the camera moved
    deco = view.decorate();
    deco.position.copy(centre);
    scene3.add(deco);
  }
  let centre = new THREE.Vector3(); // where the Focus sits in the world
  useView(view);

  function empty(group: THREE.Group) {
    for (const o of [...group.children]) {
      group.remove(o);
      o.traverse((c) => {
        if (c instanceof CSS2DObject) c.element.remove(); // CSS2D elements stay in the DOM otherwise
        if (c instanceof THREE.Sprite || c instanceof THREE.Line) {
          c.material.dispose();
          if (c instanceof THREE.Line) c.geometry.dispose();
        }
      });
    }
  }
  function clear() {
    hover(null);
    selRing.removeFromParent();
    empty(world);
    sprites = new Map();
    edges = [];
    faint = null;
    fading = [];
  }

  // A Focus change: the camera glides by the same shift as the centre, new nodes grow out of the
  // clicked node, and the old scene fades. Under reduced motion all of it happens at once.
  let move: { t0: number; from: THREE.Vector3; camera: THREE.Vector3[]; target: THREE.Vector3[]; deco: THREE.Vector3[]; old: THREE.Group } | null = null;
  function endMove() {
    if (!move) return;
    empty(move.old);
    scene3.remove(move.old);
    move = null;
  }
  function moveFocus(clicked: THREE.Vector3) {
    step(Infinity); // finish any move under way
    selRing.removeFromParent();
    const old = new THREE.Group();
    old.add(...world.children);
    old.traverse((c) => {
      if (c instanceof CSS2DObject) c.element.style.pointerEvents = "none";
    });
    scene3.add(old);
    const next = view.centreFrom?.(clicked, centre) ?? clicked.clone();
    const delta = next.clone().sub(centre);
    centre = next;
    draw();
    move = {
      t0: performance.now(),
      from: clicked,
      camera: [camera.position.clone(), camera.position.clone().add(delta)],
      target: [controls.target.clone(), controls.target.clone().add(delta)],
      deco: [centre, next],
      old,
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) step(Infinity);
    else step(move.t0);
  }
  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  function step(now: number) {
    if (!move) return;
    const k = ease(Math.min(1, (now - move.t0) / MOVE_MS));
    camera.position.lerpVectors(move.camera[0], move.camera[1], k);
    controls.target.lerpVectors(move.target[0], move.target[1], k);
    deco.position.lerpVectors(move.deco[0], move.deco[1], k);
    for (const s of sprites.values()) s.position.lerpVectors(move.from, s.userData.to, k);
    move.old.traverse((c) => {
      if (c instanceof THREE.Sprite || c instanceof THREE.Line) c.material.opacity = c.userData.opacity * (1 - k);
      if (c instanceof CSS2DObject) c.element.style.opacity = String(1 - k);
    });
    follow();
    if (k === 1) endMove();
  }

  function nodeLabel(n: SceneNode, selected: Id) {
    const d = document.createElement("div");
    d.className = `nl ${n.role}${n.shared ? " shared" : ""}${n.id === selected ? " selected" : ""}`;
    d.textContent = n.role === "overflow" ? `+${n.count} ${TYPE_PLURAL[n.type]}` : label(n.id);
    // The Focus shows its first line; a Verse always shows its quote (PRD 10.4 node look 5).
    const q = n.role === "focus" || n.type === "verse" ? quote(n.id) : "";
    if (q) {
      const p = document.createElement("div");
      p.className = "quote";
      p.textContent = q;
      d.append(p);
    }
    d.addEventListener("pointerdown", (e) => e.stopPropagation());
    // A disc under the pointer wins over the label lying across it.
    d.addEventListener("click", (e) => {
      e.stopPropagation();
      click(pick(e)?.userData.node.id ?? n.id);
    });
    const o = new CSS2DObject(d);
    o.center.set(0.5, 0);
    if (n.role !== "focus") fading.push({ el: d, obj: o });
    return o;
  }

  function draw() {
    clear();
    if (!drawn) return;
    const { scene, selected } = drawn;
    const rel = layout(scene, view.place);
    for (const n of scene.nodes) {
      const st = STYLE[n.role];
      const map = n.role === "overflow" ? TEX.plus : TEX.type[n.type];
      const s = sprite(map, n.role === "focus" ? ACCENT : TYPE_COLOUR[n.type], st.opacity, st.size, LAYER.disc);
      s.position.copy(rel.get(n.id)!).add(centre);
      const ring = n.shared ? SHARED : n.role === "pinned" ? PIN : 0;
      Object.assign(s.userData, { node: n, to: s.position.clone(), ringed: !!ring });
      if (n.role === "focus" && look.glow) s.add(sprite(TEX.glow, ACCENT, 0.55, 3.2, LAYER.glow, THREE.AdditiveBlending));
      if (ring) s.add(sprite(TEX.mask, BG, 1, RINGED, LAYER.mask), sprite(TEX.ring, ring, 0.95, RINGED, LAYER.ring));
      if (st.labelled || n.shared) s.add(nodeLabel(n, selected));
      world.add(s);
      sprites.set(n.id, s);
    }
    const pairs: THREE.Sprite[][] = [];
    for (const e of scene.edges) {
      const a = sprites.get(e.a),
        b = sprites.get(e.b);
      if (!a || !b) continue;
      if (e.kind === "ring2") {
        pairs.push([a, b]);
        continue;
      }
      // A pin's link to a Shared Node in Ring 1 is drawn bright, in the Shared colour, so it reads
      // across the scene.
      const toShared = e.kind === "pin" && sprites.get(e.b)!.userData.node.shared;
      const { color, opacity } = toShared ? { color: SHARED, opacity: 0.8 } : EDGE[e.kind];
      // A link that is only a Co-mention is dashed (PRD 10.4 edge look 8).
      const mat = e.dashed
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.7, gapSize: 0.5 })
        : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.userData.opacity = opacity;
      world.add(line);
      let lab: CSS2DObject | undefined;
      if (e.label) {
        const d = document.createElement("div");
        d.className = `el${e.dashed ? " derived" : ""}`;
        d.textContent = e.label;
        lab = new CSS2DObject(d);
        world.add(lab);
        fading.push({ el: d, obj: lab });
      }
      edges.push({ e, a, b, line, lab });
    }
    if (pairs.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pairs.length * 6), 3));
      const { color, opacity } = EDGE.ring2;
      const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
      line.frustumCulled = false;
      line.userData.opacity = opacity;
      world.add(line);
      faint = { line, pairs };
    }
    markSelected(selected);
  }

  // Edges stop at the node border. Sprites face the camera, so the border is measured in the plane
  // across the view direction; it moves whenever the camera or the nodes move.
  const fwd = new THREE.Vector3(),
    gap = new THREE.Vector3(),
    tmp = new THREE.Vector3();
  const curve = new THREE.QuadraticBezierCurve3();
  const rim = (s: THREE.Sprite) => s.scale.x * (selRing.parent === s ? SELECTED * RING_RIM : s.userData.ringed ? RINGED * RING_RIM : DISC_RIM);
  // The point on p's circle of radius r towards q.
  function onRim(out: THREE.Vector3, p: THREE.Vector3, q: THREE.Vector3, r: number) {
    out.copy(q).sub(p);
    out.addScaledVector(fwd, -out.dot(fwd));
    const len = out.length();
    return len > 1e-6 ? out.multiplyScalar(r / len).add(p) : out.copy(p);
  }
  // True when two circles overlap on screen, leaving no gap to draw an edge in.
  function touching(a: THREE.Sprite, b: THREE.Sprite) {
    gap.copy(b.position).sub(a.position);
    gap.addScaledVector(fwd, -gap.dot(fwd));
    return gap.length() <= rim(a) + rim(b);
  }
  function updateEdges() {
    camera.getWorldDirection(fwd);
    for (const { a, b, line, lab } of edges) {
      // A slight curve; each end leaves along it.
      curve.v1.copy(a.position).add(b.position).multiplyScalar(0.5);
      curve.v1.y += a.position.distanceTo(b.position) * 0.08;
      line.visible = !touching(a, b);
      onRim(curve.v0, a.position, curve.v1, rim(a));
      onRim(curve.v2, b.position, curve.v1, rim(b));
      const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i <= SEG; i++) pos.setXYZ(i, ...curve.getPoint(i / SEG, tmp).toArray());
      pos.needsUpdate = true;
      if (line.material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
      if (lab) {
        curve.getPoint(0.62, lab.position); // nearer the Neighbour, to spread the labels
        lab.visible = line.visible;
      }
    }
    if (faint) {
      const pos = faint.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      faint.pairs.forEach(([a, b], i) => {
        if (touching(a, b)) pb.copy(pa.copy(a.position)); // zero length: hidden
        else {
          onRim(pa, a.position, b.position, rim(a));
          onRim(pb, b.position, a.position, rim(b));
        }
        pos.setXYZ(2 * i, pa.x, pa.y, pa.z);
        pos.setXYZ(2 * i + 1, pb.x, pb.y, pb.z);
      });
      pos.needsUpdate = true;
    }
    const h = hovered?.userData.node as SceneNode | undefined,
      via = h?.role === "ring2" && sprites.get(h.via!);
    hoverEdge.visible = !!via && !touching(via, hovered!);
    if (via && hoverEdge.visible) {
      onRim(pa, via.position, hovered!.position, rim(via));
      onRim(pb, hovered!.position, via.position, rim(hovered!));
      hoverEdge.geometry.setFromPoints([pa, pb]);
    }
  }
  // Near labels show in full, far ones not at all; the Focus keeps its name.
  function fadeLabels() {
    for (const { el, obj } of fading) {
      const k = THREE.MathUtils.clamp((FAR - obj.getWorldPosition(tmp).distanceTo(camera.position)) / (FAR - NEAR), 0, 1);
      el.style.opacity = String(k);
      el.style.visibility = k ? "" : "hidden";
    }
  }
  function follow() {
    updateEdges();
    fadeLabels();
    // Fog starts at the Focus's depth, so nodes behind it fade at any zoom.
    if (scene3.fog instanceof THREE.Fog) {
      scene3.fog.near = camera.position.distanceTo(controls.target);
      scene3.fog.far = scene3.fog.near + 150;
    }
  }

  function markSelected(selected: Id) {
    for (const [id, s] of sprites) s.children.forEach((c) => c instanceof CSS2DObject && c.element.classList.toggle("selected", id === selected));
    selRing.removeFromParent();
    sprites.get(selected)?.add(selRing);
    follow();
  }

  // Picking. A click is a pointer down and up without a drag; two clicks on the same node within
  // 400 ms are a double click (the page may redraw between them, so native dblclick fails).
  const handlers = {
    click: [] as ((id: Id) => void)[],
    double: [] as ((id: Id) => void)[],
    hover: [] as ((n: SceneNode | null, x: number, y: number) => void)[],
    fps: [] as ((fps: number) => void)[],
  };
  let lastClick = { id: "", t: 0 };
  function click(id: Id) {
    const now = performance.now();
    if (lastClick.id === id && now - lastClick.t < DOUBLE_CLICK_MS) {
      lastClick = { id: "", t: 0 };
      handlers.double.forEach((f) => f(id));
    } else {
      lastClick = { id, t: now };
      handlers.click.forEach((f) => f(id));
    }
  }
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  function pick(e: MouseEvent): THREE.Sprite | null {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return (ray.intersectObjects([...sprites.values()], false)[0]?.object as THREE.Sprite) ?? null;
  }
  const el = renderer.domElement;
  let down: { x: number; y: number } | null = null,
    hovered: THREE.Sprite | null = null;
  const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    const hit = moved <= 5 && pick(e);
    if (hit) click(hit.userData.node.id);
  };
  // Hover lights a node and the edges on its way to the Focus (PRD 10.4 rule 4, edge look 2);
  // leaving puts them back.
  function light(s: THREE.Sprite | null, on: boolean) {
    if (!s) return;
    const n = s.userData.node as SceneNode;
    s.material.opacity = on ? Math.max(0.95, s.userData.opacity) : s.userData.opacity;
    const way = new Set([n.id, n.via]);
    for (const d of edges) if (way.has(d.e.b)) d.line.material.opacity = on ? 1 : d.line.userData.opacity;
  }
  function hover(hit: THREE.Sprite | null, x = 0, y = 0) {
    if (hit !== hovered) {
      light(hovered, false);
      light(hit, true);
      hovered = hit;
      updateEdges();
    }
    el.style.cursor = hit ? "pointer" : "";
    handlers.hover.forEach((f) => f(hit?.userData.node ?? null, x, y));
  }
  const onMove = (e: PointerEvent) => !down && hover(pick(e), e.clientX, e.clientY);
  const onLeave = () => hover(null);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);

  // Frames drawn per second, reported once a second.
  let frames = 0,
    since = performance.now();
  let raf = requestAnimationFrame(function frame(now) {
    raf = requestAnimationFrame(frame);
    frames++;
    if (now - since >= 1000) {
      handlers.fps.forEach((f) => f((frames * 1000) / (now - since)));
      frames = 0;
      since = now;
    }
    step(now);
    controls.update();
    renderer.render(scene3, camera);
    labels.render(scene3, camera);
  });

  const focusOf = (scene: Scene) => scene.nodes.find((n) => n.role === "focus")!.id;

  return {
    // A new Selected Node in the same Scene only moves the selection mark.
    render(scene: Scene, selected: Id) {
      const before = drawn;
      drawn = { scene, selected };
      if (before?.scene === scene) return markSelected(selected);
      const clicked = before && focusOf(before.scene) !== focusOf(scene) && sprites.get(focusOf(scene));
      if (clicked) moveFocus(clicked.userData.to);
      else draw();
    },
    setView(key: View) {
      step(Infinity);
      useView(VIEWS[key]);
      draw();
    },
    onNodeClick: (f: (id: Id) => void) => handlers.click.push(f),
    onNodeDoubleClick: (f: (id: Id) => void) => handlers.double.push(f),
    onHover: (f: (n: SceneNode | null, x: number, y: number) => void) => handlers.hover.push(f),
    onFps: (f: (fps: number) => void) => handlers.fps.push(f),
    // The camera goes back to the view's start.
    setLook(l: typeof look) {
      step(Infinity);
      look = l;
      useView(view);
      draw();
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      endMove();
      clear();
      selRing.traverse((c) => c instanceof THREE.Sprite && c.material.dispose());
      hoverEdge.geometry.dispose();
      hoverEdge.material.dispose();
      controls.dispose();
      [...Object.values(TEX.type), TEX.plus, TEX.mask, TEX.ring, TEX.glow].forEach((t) => t.dispose());
      renderer.dispose();
      el.remove();
      labels.domElement.remove();
    },
    // Test only: every drawn node with its position on the page, for browser tests to click.
    testNodes() {
      const r = el.getBoundingClientRect(),
        v = new THREE.Vector3();
      camera.updateMatrixWorld(); // the camera may have moved since the last frame drawn
      return [...sprites.values()].map((s) => {
        s.getWorldPosition(v).project(camera);
        const n = s.userData.node as SceneNode;
        return { id: n.id, role: n.role, x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      });
    },
  };
}
