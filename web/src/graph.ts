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
  ACCENT = 0xffd27a;
const TYPE_COLOUR: Record<NodeType, number> = {
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
  pinring: { size: 1.3, opacity: 0.8, labelled: false },
  path: { size: 1.5, opacity: 0.45, labelled: false },
  ring2: { size: 0.8, opacity: 0.32, labelled: false },
};
const EDGE_OPACITY: Record<SceneEdge["kind"], number> = { focus: 0.55, overflow: 0.25, path: 0.5, pin: 0.4, ring2: 0.14 };

function discTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type Graph = ReturnType<typeof createGraph>;

// label(id) names a node; quote(id) is a loaded Verse's short BSB quote, else "". Throws when the
// browser has no WebGL.
export function createGraph(host: HTMLElement, label: (id: Id) => string, quote: (id: Id) => string) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = "labels";
  host.appendChild(labels.domElement);

  const scene3 = new THREE.Scene();
  scene3.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1000);
  const world = new THREE.Group();
  scene3.add(world);
  const disc = discTexture();

  let view = VIEWS.A,
    controls: OrbitControls,
    deco: THREE.Object3D;
  let current: { scene: Scene; selected: Id } | null = null;
  let sprites = new Map<Id, THREE.Sprite>();
  let edgeLines: THREE.LineSegments[] = [];

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
    camera.position.set(0, 0, 0);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    view.setup(camera, controls);
    camera.position.add(centre);
    controls.target.add(centre);
    controls.update();
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
        if (c instanceof THREE.Sprite || c instanceof THREE.LineSegments) {
          c.material.dispose();
          if (c instanceof THREE.LineSegments) c.geometry.dispose();
        }
      });
    }
  }
  function clear() {
    empty(world);
    sprites = new Map();
    edgeLines = [];
  }

  // A Focus change: the camera glides by the same shift as the centre, new nodes grow out of the
  // clicked node, and the old scene fades. Under reduced motion all of it happens at once.
  let move: { t0: number; from: THREE.Vector3; P: THREE.Vector3[]; T: THREE.Vector3[]; D: THREE.Vector3[]; old: THREE.Group } | null = null;
  function endMove() {
    if (!move) return;
    empty(move.old);
    scene3.remove(move.old);
    move = null;
  }
  function moveFocus(clicked: THREE.Vector3) {
    step(Infinity); // finish any move under way
    const old = new THREE.Group();
    old.add(...world.children);
    old.traverse((c) => {
      if (c instanceof CSS2DObject) c.element.style.pointerEvents = "none";
    });
    scene3.add(old);
    const next = view.centreFrom?.(clicked, centre) ?? clicked.clone();
    const delta = next.clone().sub(centre);
    const D = [centre, next];
    centre = next;
    draw();
    const P = [camera.position.clone(), camera.position.clone().add(delta)];
    const T = [controls.target.clone(), controls.target.clone().add(delta)];
    move = { t0: performance.now(), from: clicked, P, T, D, old };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) step(Infinity);
    else step(move.t0);
  }
  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  function step(now: number) {
    if (!move) return;
    const k = ease(Math.min(1, (now - move.t0) / MOVE_MS));
    camera.position.lerpVectors(move.P[0], move.P[1], k);
    controls.target.lerpVectors(move.T[0], move.T[1], k);
    deco.position.lerpVectors(move.D[0], move.D[1], k);
    for (const s of sprites.values()) s.position.lerpVectors(move.from, s.userData.to, k);
    move.old.traverse((c) => {
      if (c instanceof THREE.Sprite || c instanceof THREE.LineSegments) c.material.opacity = c.userData.opacity * (1 - k);
      if (c instanceof CSS2DObject) c.element.style.opacity = String(1 - k);
    });
    updateEdges();
    if (k === 1) endMove();
  }

  function nodeLabel(n: SceneNode, selected: Id) {
    const d = document.createElement("div");
    d.className = `nl ${n.role}${n.shared ? " shared" : ""}${n.id === selected ? " selected" : ""}`;
    d.textContent = n.role === "overflow" ? `+${n.count} ${TYPE_PLURAL[n.type]}` : label(n.id);
    if (quote(n.id)) {
      const q = document.createElement("div");
      q.className = "quote";
      q.textContent = quote(n.id);
      d.append(q);
    }
    d.addEventListener("pointerdown", (e) => e.stopPropagation());
    d.addEventListener("click", (e) => {
      e.stopPropagation();
      click(n.id);
    });
    const o = new CSS2DObject(d);
    o.center.set(0.5, 0);
    return o;
  }

  function draw() {
    clear();
    if (!current) return;
    const { scene, selected } = current;
    const rel = layout(scene, view.place);
    for (const n of scene.nodes) {
      const st = STYLE[n.role];
      const material = new THREE.SpriteMaterial({
        map: disc,
        color: n.role === "focus" ? ACCENT : TYPE_COLOUR[n.type],
        transparent: true,
        opacity: st.opacity,
        // Nodes ignore depth and draw after every line, so no line crosses a node.
        depthTest: false,
        depthWrite: false,
      });
      const s = new THREE.Sprite(material);
      s.scale.setScalar(st.size);
      s.renderOrder = 1;
      s.position.copy(rel.get(n.id)!).add(centre);
      s.userData = { node: n, opacity: st.opacity, to: s.position.clone() };
      if (st.labelled || n.shared) s.add(nodeLabel(n, selected)); // a Shared Node around a pin is labelled too
      world.add(s);
      sprites.set(n.id, s);
    }
    // One set of line segments per edge kind, following the nodes as they move.
    const byKind = new Map<SceneEdge["kind"], THREE.Sprite[][]>();
    for (const e of scene.edges) {
      const a = sprites.get(e.a),
        b = sprites.get(e.b);
      if (!a || !b) continue;
      if (!byKind.has(e.kind)) byKind.set(e.kind, []);
      byKind.get(e.kind)!.push([a, b]);
    }
    for (const [kind, pairs] of byKind) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pairs.length * 6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xc8cde0, transparent: true, opacity: EDGE_OPACITY[kind] });
      const line = new THREE.LineSegments(geo, mat);
      line.frustumCulled = false;
      line.userData = { pairs, opacity: EDGE_OPACITY[kind] };
      world.add(line);
      edgeLines.push(line);
    }
    updateEdges();
  }

  function updateEdges() {
    for (const line of edgeLines) {
      const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      (line.userData.pairs as THREE.Sprite[][]).forEach(([a, b], i) => {
        pos.setXYZ(2 * i, a.position.x, a.position.y, a.position.z);
        pos.setXYZ(2 * i + 1, b.position.x, b.position.y, b.position.z);
      });
      pos.needsUpdate = true;
    }
  }

  function markSelected(selected: Id) {
    for (const [id, s] of sprites) s.children.forEach((c) => c instanceof CSS2DObject && c.element.classList.toggle("selected", id === selected));
  }

  // Picking. A click is a pointer down and up without a drag; two clicks on the same node within
  // 400 ms are a double click (the page may redraw between them, so native dblclick fails).
  const handlers = {
    click: [] as ((id: Id) => void)[],
    double: [] as ((id: Id) => void)[],
    hover: [] as ((n: SceneNode | null, x: number, y: number) => void)[],
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
  function pick(e: PointerEvent): THREE.Sprite | null {
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
  const onMove = (e: PointerEvent) => {
    if (down) return;
    const hit = pick(e);
    if (hovered && hovered !== hit) hovered.material.opacity = hovered.userData.opacity;
    hovered = hit;
    el.style.cursor = hit ? "pointer" : "";
    if (hit) hit.material.opacity = Math.max(0.95, hit.userData.opacity); // Ring 2 lights up on hover
    handlers.hover.forEach((f) => f(hit?.userData.node ?? null, e.clientX, e.clientY));
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointermove", onMove);

  let raf = requestAnimationFrame(function frame(now) {
    raf = requestAnimationFrame(frame);
    step(now);
    controls.update();
    renderer.render(scene3, camera);
    labels.render(scene3, camera);
  });

  const focusOf = (sc: Scene) => sc.nodes.find((n) => n.role === "focus")!.id;

  return {
    // A new Selected Node in the same Scene only moves the selection mark.
    render(scene: Scene, selected: Id) {
      const before = current;
      current = { scene, selected };
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
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      endMove();
      clear();
      controls.dispose();
      disc.dispose();
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
