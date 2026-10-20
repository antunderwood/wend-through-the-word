// What a view gives the graph module: node positions, a camera set up with its controls, and its
// decoration. Nothing else differs between views (decision 114).
import * as THREE from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TYPES, type Id, type Scene } from "../model";

export type ViewModule = {
  setup(camera: THREE.PerspectiveCamera, controls: OrbitControls): void;
  decorate(): THREE.Object3D;
  fog?: boolean; // depth fog on far nodes
  // The next Focus centre when the node at p becomes the Focus; p itself when left out.
  centreFrom?(p: THREE.Vector3, centre: THREE.Vector3): THREE.Vector3;
  place: {
    focus(): THREE.Vector3;
    ring1(angle: number, pos: number): THREE.Vector3;
    ring2(angle: number, rank: number, parent: THREE.Vector3): THREE.Vector3;
    path(i: number): THREE.Vector3;
    pin(i: number): THREE.Vector3;
    pinRing(pin: THREE.Vector3, typeIndex: number, rank: number): THREE.Vector3;
  };
};

export const W = (Math.PI * 2) / TYPES.length; // one sector per node type
// Place pos of size places in a sector, using 85% of the sector.
const sectorAngle = (sector: number, pos: number, size: number) => -Math.PI / 2 + sector * W + ((pos + 0.5) / size - 0.5) * W * 0.85;
export const flat = (a: number, r: number, y = 0) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

// Positions relative to the Focus, the same skeleton for every view.
export function layout(scene: Scene, place: ViewModule["place"]): Map<Id, THREE.Vector3> {
  const rel = new Map<Id, THREE.Vector3>(),
    r1 = new Map<Id, { a: number; size: number; p: THREE.Vector3 }>();
  for (const n of scene.nodes)
    if (n.ring1) {
      const a = sectorAngle(n.ring1.sector, n.ring1.pos, n.ring1.size);
      r1.set(n.id, { a, size: n.ring1.size, p: place.ring1(a, n.ring1.pos) });
    }
  for (const n of scene.nodes) {
    if (n.role === "focus") rel.set(n.id, place.focus());
    else if (n.role === "ring1" || n.role === "overflow") rel.set(n.id, r1.get(n.id)!.p);
    else if (n.role === "pinned") rel.set(n.id, place.pin(n.pinIndex!));
    else if (n.role === "path") rel.set(n.id, place.path(n.pathIndex!));
  }
  for (const n of scene.nodes) {
    if (n.role === "pinring") rel.set(n.id, place.pinRing(rel.get(n.pin!)!, n.typeIndex!, n.rank!));
    else if (n.role === "ring2") {
      // Spread around the parent's angle, on a band outside Ring 1.
      const par = r1.get(n.via!)!;
      rel.set(n.id, place.ring2(par.a + (n.rank! - 1) * ((W * 0.85) / par.size) * 0.3, n.rank!, par.p));
    }
  }
  return rel;
}
