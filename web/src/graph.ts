// The graph module: draws a Scene with three.js. No Svelte import, so the scene can be used and
// tested apart from the panels (PRD 10.3 rule 1). Each view only places nodes and sets up the
// camera, controls, and decoration.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { overflowText, type Id, type NodeType, type Role, type Scene, type SceneEdge, type SceneNode, type View } from "./model";
import { viewA } from "./views/a";
import { viewB } from "./views/b";
import { viewC } from "./views/c";
import { layout, type ViewModule } from "./views/view";
import { namePriority, uncrowded, WORDS_PRIORITY } from "./declutter";
import { TYPE_COLOUR } from "./colours";
import "./graph.css";

// The tilted plane (the default, decision 118), stacked discs, and free orbit.
export const VIEWS: Record<View, ViewModule> = { A: viewA, B: viewB, C: viewC };
// Two clicks on one node within this time are a double click; the map's dots and Your Path use it too.
export const DOUBLE_CLICK_MS = 400;
// A click on id, which is the second of a double click when the last one was on id within that time.
// Timed by hand, by id, since the page may redraw between the two clicks and native dblclick fails.
export function doubleClickTimer(): (id: Id) => boolean {
  let last = { id: "", t: 0 };
  return (id) => {
    const now = performance.now(),
      double = last.id === id && now - last.t < DOUBLE_CLICK_MS;
    last = double ? { id: "", t: 0 } : { id, t: now };
    return double;
  };
}
const MOVE_MS = 700;

const BG = 0x0d0f17,
  ACCENT = 0xffd27a,
  SHARED = 0x4ff0e0,
  PIN = 0xff9f6e;
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
  // Node names and Relationship words, for hiding a name that would overlap a more important one.
  // size is read from the page once per scene.
  type Name = { el: HTMLElement; obj: CSS2DObject; node?: SceneNode; edge?: Id; size?: { w: number; h: number; dy: number } };
  let names: Name[] = [],
    crowded = true; // names need placing again

  // Pixels at the bottom or the right of the scene covered by a panel (the phone's sheet): the picture
  // moves up or left by half of them, so its centre sits in the space above or left of the panel.
  // shift: px the picture is panned by on the page (panTo), until panBack, a sheet change, Recentre,
  // or the camera going back to the view's start. zoomedOut: how far panTo moved the camera back.
  // offset: the px the picture is moved by as drawn, which eases to where these put it.
  let covered = 0,
    coveredSide: "bottom" | "right" = "bottom",
    shift = { x: 0, y: 0 },
    zoomedOut = 1;
  const offsetFor = () => ({ x: (coveredSide === "right" ? covered / 2 : 0) - shift.x, y: (coveredSide === "bottom" ? covered / 2 : 0) - shift.y });
  let offset = offsetFor();
  function setViewOffset() {
    const { clientWidth: w, clientHeight: h } = host;
    if (offset.x || offset.y) camera.setViewOffset(w, h, offset.x, offset.y, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    crowded = true;
  }
  function resize() {
    const { clientWidth: w, clientHeight: h } = host;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    setViewOffset();
  }
  resize();
  // The page's panels change the scene's size as well as the window.
  const sized = new ResizeObserver(resize);
  sized.observe(host);

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
    home = camera.position.clone();
    controls.autoRotate = look.spin;
    camera.position.add(centre);
    controls.target.add(centre);
    controls.update();
    controls.addEventListener("change", () => follow()); // the camera moved
    deco = view.decorate();
    deco.position.copy(centre);
    scene3.add(deco);
    glide = null;
    shift = { x: 0, y: 0 };
    zoomedOut = 1;
    offset = offsetFor();
    setViewOffset();
  }
  let centre = new THREE.Vector3(), // where the Focus sits in the world
    home = new THREE.Vector3(); // the view's start: the camera's place from the centre
  // The camera easing to a place, and the picture's offset with it (glideTo).
  let glide: { t0: number; camera: THREE.Vector3[]; target: THREE.Vector3[]; offset: { x: number; y: number }[] } | null = null;
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
    names = [];
  }

  // A Focus change: the camera glides by the same shift as the centre, new nodes grow out of the
  // clicked node, and the old scene fades. Under reduced motion, or with animation turned off in
  // the filter panel, all of it happens at once.
  let motion = true;
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
    step(still() ? Infinity : move.t0);
  }
  const still = () => !motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  // The camera eases to a place (its position and target), and the picture's offset to where the
  // sheet and the pans now put it (decision 188). At once under reduced motion, with animation off,
  // or when asked; a finger or the mouse on the scene ends it where it was going.
  function glideTo(position: THREE.Vector3, target: THREE.Vector3, atOnce = false) {
    step(Infinity); // a Focus move ends first
    // What is left of a damped drag is spent first, so it does not carry the camera on afterwards.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    glide = { t0: performance.now(), camera: [camera.position.clone(), position], target: [controls.target.clone(), target], offset: [offset, offsetFor()] };
    glideStep(atOnce || still() ? Infinity : glide.t0);
  }
  function glideStep(now: number) {
    if (!glide) return;
    const k = ease(Math.min(1, (now - glide.t0) / MOVE_MS)),
      [a, b] = glide.offset;
    camera.position.lerpVectors(glide.camera[0], glide.camera[1], k);
    controls.target.lerpVectors(glide.target[0], glide.target[1], k);
    offset = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    setViewOffset();
    follow();
    if (k === 1) glide = null;
  }
  // Where the camera is going: the end of its glide, or where it is.
  const aim = () => (glide ? { camera: glide.camera[1], target: glide.target[1] } : { camera: camera.position, target: controls.target });
  // The Focus in the middle of the free scene, from the same angle and distance.
  function centreFocus(atOnce = false) {
    const { camera: c, target: t } = aim();
    glideTo(c.clone().sub(t).add(centre), centre.clone(), atOnce);
  }
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
    d.dataset.node = n.id;
    d.textContent = n.role === "overflow" ? overflowText(n.count!, n.type) : label(n.id);
    // The Focus shows its first line; a Verse always shows its quote (PRD 10.4 node look 5).
    const q = n.role === "focus" || n.type === "verse" ? quote(n.id) : "";
    if (q) {
      const p = document.createElement("div");
      p.className = "quote";
      p.textContent = q;
      d.append(p);
    }
    // A finger on a name works as on the scene: the canvas takes the touch, so a drag or a pinch
    // that starts on a name moves the camera, and a tap is picked there. The canvas captures the
    // finger, so it hears the finger lift: a touch belongs to the element it began on, and a lift
    // the canvas missed counted every later tap as part of a pinch.
    d.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (e.pointerType !== "touch") return;
      onName = n.id;
      el.setPointerCapture(e.pointerId);
      el.dispatchEvent(new PointerEvent(e.type, e));
    });
    // A disc under the pointer wins over the label lying across it.
    d.addEventListener("click", (e) => {
      e.stopPropagation();
      if ((e as PointerEvent).pointerType !== "touch") click(pick(e)?.userData.node.id ?? n.id);
    });
    const o = new CSS2DObject(d);
    o.center.set(0.5, 0);
    if (n.role !== "focus") fading.push({ el: d, obj: o });
    names.push({ el: d, obj: o, node: n });
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
        names.push({ el: d, obj: lab, edge: e.b });
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
    const words = [drawn?.selected, hovered?.userData.node.id];
    for (const { e, a, b, line, lab } of edges) {
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
        // Relationship words only on the Selected Node's edge and a hovered node's (decision 124).
        lab.visible = line.visible && words.includes(e.b);
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
    crowded = true;
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

  // A name that would overlap a more important one is hidden until a zoom or a camera move makes
  // room (decision 124); a hovered node's name and words always show. Runs after the labels are
  // drawn, so each name's place on the page is known.
  function declutter() {
    const { clientWidth: w, clientHeight: h } = host,
      hov = hovered?.userData.node.id,
      selected = drawn?.selected ?? "";
    const placed: { L: Name; box: { left: number; top: number; right: number; bottom: number }; priority: number }[] = [];
    for (const L of names) {
      if (L.el.style.display === "none" || L.el.style.visibility === "hidden" || (L.node?.id ?? L.edge) === hov) continue;
      if (!L.size?.w) {
        const { width: w, height: h } = L.el.getBoundingClientRect(); // unrounded, unlike offsetWidth
        L.size = { w, h, dy: parseFloat(getComputedStyle(L.el).marginTop) };
      }
      tmp.setFromMatrixPosition(L.obj.matrixWorld).project(camera);
      const left = ((tmp.x + 1) / 2) * w - L.obj.center.x * L.size.w,
        top = ((1 - tmp.y) / 2) * h - L.obj.center.y * L.size.h + L.size.dy;
      const priority = L.node ? namePriority(L.node, selected) : WORDS_PRIORITY;
      placed.push({ L, box: { left, top, right: left + L.size.w, bottom: top + L.size.h }, priority });
    }
    // Every size is read before any class changes, so the page lays out at most once.
    const shows = uncrowded(placed),
      hidden = new Set(placed.filter((_, i) => !shows[i]).map((p) => p.L));
    for (const L of names) L.el.classList.toggle("crowded", hidden.has(L));
  }

  // Picking. A click is a pointer down and up without a drag.
  const handlers = {
    click: [] as ((id: Id) => void)[],
    double: [] as ((id: Id) => void)[],
    hover: [] as ((n: SceneNode | null, x: number, y: number) => void)[],
    fps: [] as ((fps: number) => void)[],
  };
  const isDouble = doubleClickTimer();
  const click = (id: Id) => (isDouble(id) ? handlers.double : handlers.click).forEach((f) => f(id));
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  function pick(e: MouseEvent): THREE.Sprite | null {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return (ray.intersectObjects([...sprites.values()], false)[0]?.object as THREE.Sprite) ?? null;
  }
  // A touch cannot hover, so a tap stands in for it: the tapped node shows what a hovered one does
  // (decision 124) until the next tap, a camera move, or another Selected Node.
  const el = renderer.domElement;
  const down = new Map<number, { x: number; y: number }>(); // pointers down, by id
  let pinched = false, // two fingers were down: not a tap
    onName: Id | null = null, // the node whose name the touch began on
    tapped = false, // hovered by a tap, not a mouse
    hovered: THREE.Sprite | null = null;
  const onDown = (e: PointerEvent) => {
    // A finger moves the camera without damping, so it stops when the finger lifts; a finger lifts
    // while still moving, where a mouse stops first, and the damped camera glided on for seconds.
    // A mouse keeps the damping.
    controls.enableDamping = e.pointerType !== "touch";
    glideStep(Infinity); // the camera is where it was going before the reader moves it
    down.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (down.size > 1) pinched = true;
  };
  const onUp = (e: PointerEvent) => {
    const at = down.get(e.pointerId);
    down.delete(e.pointerId);
    const name = onName;
    if (!down.size) onName = null;
    if (!at) return;
    const moved = Math.hypot(e.clientX - at.x, e.clientY - at.y) > 5 || pinched;
    if (!down.size) pinched = false;
    const hit = !moved && (pick(e) ?? (name ? sprites.get(name) : null));
    if (e.pointerType === "touch") {
      tapped = !!hit;
      hover(hit || null, e.clientX, e.clientY);
    }
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
      crowded = true;
    }
    el.style.cursor = hit ? "pointer" : "";
    handlers.hover.forEach((f) => f(hit?.userData.node ?? null, x, y));
  }
  // A touch's moves and its leaving at the end are not hovers.
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || down.size) return;
    tapped = false;
    hover(pick(e), e.clientX, e.clientY);
  };
  const onLeave = (e: PointerEvent) => e.pointerType !== "touch" && hover(null);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", (e) => down.delete(e.pointerId));
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("wheel", () => glideStep(Infinity), { passive: true });

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
    glideStep(now);
    controls.update();
    renderer.render(scene3, camera);
    labels.render(scene3, camera);
    if (crowded) {
      crowded = false;
      declutter();
    }
  });

  const focusOf = (scene: Scene) => scene.nodes.find((n) => n.role === "focus")!.id;

  // A drawn node's disc on the page, with its ring when it has one, as a square round its centre;
  // null when the node is not drawn.
  function nodeRect(id: Id) {
    const s = sprites.get(id);
    if (!s) return null;
    const r = el.getBoundingClientRect(),
      c = new THREE.Vector3(),
      edge = new THREE.Vector3();
    camera.updateMatrixWorld(); // the camera may have moved since the last frame drawn
    s.getWorldPosition(c);
    // A point on the rim, across the view from the centre: sprites face the camera.
    edge.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(rim(s)).add(c).project(camera);
    c.project(camera);
    const x = r.left + ((c.x + 1) / 2) * r.width,
      y = r.top + ((1 - c.y) / 2) * r.height,
      radius = Math.hypot(((edge.x - c.x) / 2) * r.width, ((edge.y - c.y) / 2) * r.height);
    return new DOMRect(x - radius, y - radius, 2 * radius, 2 * radius);
  }

  return {
    // A new Selected Node in the same Scene only moves the selection mark.
    render(scene: Scene, selected: Id) {
      const before = drawn;
      drawn = { scene, selected };
      if (tapped && hovered?.userData.node.id !== selected) hover(null);
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
    setMotion(on: boolean) {
      motion = on;
    },
    // The scene's bottom (or right) px are covered: its centre moves into the space above (or left of)
    // them, and the camera eases so the Focus is in the middle of that space, undoing any pan (decision
    // 188). The first offset, before which nothing was covered, applies at once.
    setOffset(px: number, side: "bottom" | "right" = "bottom") {
      if (px === covered && side === coveredSide) return;
      const first = !covered;
      covered = px;
      coveredSide = side;
      shift = { x: 0, y: 0 };
      centreFocus(first);
    },
    nodeRect,
    // Pans the picture so a drawn node's disc centre lies at (x, y) on the page, after moving the
    // camera back by zoomOut times its distance (1 keeps the zoom; never past the view's farthest).
    // The orbit keeps its centre; the pan lasts until panBack, a change of the sheet, or Recentre.
    panTo(id: Id, x: number, y: number, zoomOut = 1) {
      if (!sprites.has(id)) return;
      glideStep(Infinity);
      if (zoomOut !== 1) {
        const d = camera.position.distanceTo(controls.target),
          to = Math.min(d * zoomOut, controls.maxDistance);
        camera.position.sub(controls.target).setLength(to).add(controls.target);
        zoomedOut *= to / d;
      }
      const r = nodeRect(id)!;
      shift = { x: shift.x + x - (r.left + r.width / 2), y: shift.y + y - (r.top + r.height / 2) };
      offset = offsetFor();
      setViewOffset();
      follow();
    },
    // Eases back the pans panTo made, and its zoom (decision 188): the tour undoes its pan for a step
    // when the step ends. The reader's own moves stay.
    panBack() {
      if (!shift.x && !shift.y && zoomedOut === 1) return;
      step(Infinity);
      const { camera: c, target: t } = aim(),
        back = c.clone().sub(t);
      back.setLength(Math.max(back.length() / zoomedOut, controls.minDistance));
      shift = { x: 0, y: 0 };
      zoomedOut = 1;
      glideTo(back.add(t), t.clone());
    },
    // The camera eases back to the view's start round the Focus, in the middle of the free scene,
    // undoing every pan, zoom, and turn (the Recentre button, decision 188).
    recentre() {
      shift = { x: 0, y: 0 };
      zoomedOut = 1;
      glideTo(home.clone().add(centre), centre.clone());
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
      sized.disconnect();
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
