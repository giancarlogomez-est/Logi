import { MeshStandardMaterial, type Material } from 'three';
import type { EntityType } from '../data/demo';

/** Modelos low-poly hechos con primitivas. Miran hacia +X; unidades en metros. */

const mat = (color: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, flatShading: true, ...extra });

const M = {
  yellow: mat('#f5b311'),
  yellowDark: mat('#d99a06'),
  dark: mat('#3b4250'),
  tire: mat('#262a33', { roughness: 0.9 }),
  steel: mat('#9aa3b2', { metalness: 0.3 }),
  glass: mat('#8fb4e8', { roughness: 0.2, metalness: 0.2 }),
  blue: mat('#3557e0'),
  white: mat('#f3f5f8'),
  bed: mat('#e6e9ee'),
  vest: mat('#ff7a1a'),
  pants: mat('#2f4a8a'),
  skin: mat('#d9a27a'),
  helmet: mat('#ffffff'),
  helmetY: mat('#ffd21a'),
  gravel: mat('#b9ab92', { roughness: 1 }),
  gravelDark: mat('#a39478', { roughness: 1 }),
  sign: mat('#3557e0'),
};

type V3 = [number, number, number];

function B({ s, p, r, m }: { s: V3; p: V3; r?: V3; m: Material }) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow receiveShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

function Wheel({ p, r = 0.55, w = 0.45 }: { p: V3; r?: number; w?: number }) {
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]} material={M.tire} castShadow>
      <cylinderGeometry args={[r, r, w, 12]} />
    </mesh>
  );
}

function Volqueta() {
  return (
    <group>
      <B s={[7.6, 0.45, 2.1]} p={[0, 1.05, 0]} m={M.dark} />
      <B s={[2.0, 2.0, 2.4]} p={[2.7, 2.25, 0]} m={M.blue} />
      <B s={[0.05, 0.75, 2.0]} p={[3.71, 2.75, 0]} m={M.glass} />
      <B s={[1.2, 0.75, 0.05]} p={[2.9, 2.75, 1.21]} m={M.glass} />
      <B s={[1.2, 0.75, 0.05]} p={[2.9, 2.75, -1.21]} m={M.glass} />
      <B s={[4.8, 1.7, 2.5]} p={[-1.1, 2.15, 0]} m={M.bed} />
      <B s={[4.8, 0.25, 2.52]} p={[-1.1, 2.6, 0]} m={M.blue} />
      {[2.6, -0.5, -1.9].map((x) => [1.15, -1.15].map((z) => <Wheel key={`${x}${z}`} p={[x, 0.55, z]} />))}
    </group>
  );
}

function Excavadora() {
  return (
    <group>
      <B s={[4.4, 0.8, 0.8]} p={[0, 0.4, 1.2]} m={M.dark} />
      <B s={[4.4, 0.8, 0.8]} p={[0, 0.4, -1.2]} m={M.dark} />
      <B s={[3.0, 0.4, 1.8]} p={[0, 0.95, 0]} m={M.steel} />
      <B s={[3.2, 1.2, 2.6]} p={[-0.4, 1.75, 0]} m={M.yellow} />
      <B s={[0.8, 1.1, 2.6]} p={[-2.2, 1.7, 0]} m={M.yellowDark} />
      <B s={[1.2, 1.5, 1.0]} p={[0.7, 3.05, 0.75]} m={M.yellow} />
      <B s={[1.0, 0.9, 0.05]} p={[0.75, 3.25, 1.26]} m={M.glass} />
      <B s={[0.05, 0.9, 0.85]} p={[1.31, 3.25, 0.75]} m={M.glass} />
      <B s={[3.8, 0.5, 0.5]} p={[2.3, 3.4, -0.2]} r={[0, 0, 0.55]} m={M.yellow} />
      <B s={[2.8, 0.38, 0.38]} p={[4.6, 3.3, -0.2]} r={[0, 0, -1.0]} m={M.yellow} />
      <B s={[1.0, 0.9, 1.1]} p={[5.3, 1.85, -0.2]} r={[0, 0, 0.4]} m={M.dark} />
    </group>
  );
}

function Motoniveladora() {
  return (
    <group>
      <B s={[6.6, 0.45, 0.6]} p={[0.6, 1.7, 0]} m={M.yellow} />
      <B s={[2.4, 1.3, 2.2]} p={[-2.4, 1.65, 0]} m={M.yellow} />
      <B s={[1.5, 1.7, 1.9]} p={[-0.7, 2.75, 0]} m={M.yellowDark} />
      <B s={[0.05, 1.0, 1.6]} p={[0.06, 3.0, 0]} m={M.glass} />
      <B s={[0.3, 0.8, 3.8]} p={[0.9, 0.55, 0]} r={[0, 0.45, 0]} m={M.steel} />
      <Wheel p={[3.6, 0.65, 1.0]} r={0.65} />
      <Wheel p={[3.6, 0.65, -1.0]} r={0.65} />
      {[-1.9, -3.2].map((x) => [1.1, -1.1].map((z) => <Wheel key={`${x}${z}`} p={[x, 0.65, z]} r={0.65} />))}
    </group>
  );
}

function Vibrocompactador() {
  return (
    <group>
      <mesh position={[1.6, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.steel} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 2.1, 14]} />
      </mesh>
      <B s={[0.5, 1.0, 2.4]} p={[1.6, 1.45, 0]} m={M.yellow} />
      <B s={[2.4, 1.2, 1.8]} p={[-0.6, 1.4, 0]} m={M.yellow} />
      <B s={[1.4, 0.1, 1.7]} p={[-0.5, 3.1, 0]} m={M.dark} />
      {[0.1, -1.1].map((x) => [0.8, -0.8].map((z) => <B key={`${x}${z}`} s={[0.08, 1.1, 0.08]} p={[x, 2.5, z]} m={M.dark} />))}
      <Wheel p={[-1.0, 0.7, 0.95]} r={0.7} w={0.5} />
      <Wheel p={[-1.0, 0.7, -0.95]} r={0.7} w={0.5} />
    </group>
  );
}

function Worker({ p, helmet }: { p: V3; helmet: Material }) {
  return (
    <group position={p}>
      <B s={[0.3, 0.8, 0.4]} p={[0, 0.4, 0]} m={M.pants} />
      <B s={[0.34, 0.65, 0.5]} p={[0, 1.13, 0]} m={M.vest} />
      <mesh position={[0, 1.6, 0]} material={M.skin} castShadow>
        <sphereGeometry args={[0.16, 8, 6]} />
      </mesh>
      <mesh position={[0, 1.68, 0]} material={helmet} castShadow>
        <sphereGeometry args={[0.2, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

function Cuadrilla() {
  const spots: V3[] = [
    [0, 0, 0],
    [1.3, 0, 0.7],
    [-0.9, 0, 1.1],
    [0.5, 0, -1.2],
    [-1.4, 0, -0.5],
  ];
  return (
    <group scale={1.6}>
      {spots.map((p, i) => (
        <Worker key={i} p={p} helmet={i === 0 ? M.helmetY : M.helmet} />
      ))}
      {/* trípode */}
      {[0, 2.1, 4.2].map((a) => (
        <B key={a} s={[0.05, 1.4, 0.05]} p={[2.2 + Math.cos(a) * 0.25, 0.65, Math.sin(a) * 0.25 - 0.6]} r={[Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]} m={M.dark} />
      ))}
      <B s={[0.25, 0.3, 0.25]} p={[2.2, 1.45, -0.6]} m={M.yellow} />
    </group>
  );
}

function Acopio() {
  return (
    <group>
      <mesh position={[0, 1.6, 0]} material={M.gravel} castShadow receiveShadow>
        <coneGeometry args={[7, 3.2, 9]} />
      </mesh>
      <mesh position={[3.5, 1.1, 2.5]} material={M.gravelDark} castShadow receiveShadow>
        <coneGeometry args={[4, 2.2, 8]} />
      </mesh>
      <B s={[0.12, 2.4, 0.12]} p={[-6.5, 1.2, 4]} m={M.dark} />
      <B s={[0.1, 1.0, 1.8]} p={[-6.5, 2.4, 4]} m={M.sign} />
    </group>
  );
}

export function EntityModel({ type }: { type: EntityType }) {
  switch (type) {
    case 'volqueta':
      return <Volqueta />;
    case 'excavadora':
      return <Excavadora />;
    case 'motoniveladora':
      return <Motoniveladora />;
    case 'vibrocompactador':
      return <Vibrocompactador />;
    case 'cuadrilla':
      return <Cuadrilla />;
    case 'acopio':
      return <Acopio />;
  }
}
