import { MapControls, useCursor } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mesh, Plane, Vector3, type DirectionalLight, type PerspectiveCamera } from 'three';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { FOOTPRINT, type Entity } from '../data/demo';
import { buildGroundGeometry, buildMarkingGeometry, buildRoadGeometry, edgeLineLeft, edgeLineRight } from '../geo/meshes';
import type { World } from '../geo/world';
import { useStore } from '../store';
import { LABELS_LAYER_ID, stationLabelOffset, visibleStations } from '../ui/Labels';
import { EntityModel } from './models';

const SKY = '#e8eef6';
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Scene() {
  const world = useStore((s) => s.world);
  const select = useStore((s) => s.select);
  if (!world) return null;
  return (
    <Canvas
      className="scene"
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.5, far: 40000, position: [200, 200, 200] }}
      onPointerMissed={() => select(null)}
      onCreated={(st) => {
        if (import.meta.env.DEV) (window as unknown as { r3f: typeof st }).r3f = st;
      }}
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 2500, 12000]} />
      <Lights />
      <WorldMesh world={world} />
      <StationPosts world={world} />
      <LabelProjector />
      <Entities world={world} />
      <CameraRig world={world} />
    </Canvas>
  );
}

function Lights() {
  const light = useRef<DirectionalLight>(null!);
  const controls = useThree((s) => s.controls) as MapControlsImpl | null;
  useFrame(() => {
    const t = controls?.target;
    if (!t) return;
    light.current.position.set(t.x + 140, t.y + 260, t.z + 90);
    light.current.target.position.copy(t);
    light.current.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={['#ffffff', '#b8c6a4', 1.5]} />
      <directionalLight
        ref={light}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
        shadow-camera-near={10}
        shadow-camera-far={800}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
}

function WorldMesh({ world }: { world: World }) {
  const geo = useMemo(
    () => ({
      ground: buildGroundGeometry(world),
      road: buildRoadGeometry(world),
      center: buildMarkingGeometry(world, () => 0, 0.15),
      edgeL: buildMarkingGeometry(world, edgeLineLeft, 0.15),
      edgeR: buildMarkingGeometry(world, edgeLineRight, 0.15),
    }),
    [world],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  return (
    <group>
      <mesh geometry={geo.ground} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={geo.road} receiveShadow>
        <meshStandardMaterial color="#5d6473" roughness={0.9} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh geometry={geo.center}>
        <meshStandardMaterial color="#ffc61a" roughness={0.6} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      {[geo.edgeL, geo.edgeR].map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#ffffff" roughness={0.6} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      ))}
    </group>
  );
}

/** Hitos (postes) en las abscisas visibles; el texto lo pone LabelsLayer */
function StationPosts({ world }: { world: World }) {
  const viewSta = useStore((s) => s.viewSta);
  const viewDist = useStore((s) => s.viewDist);
  return (
    <>
      {visibleStations(world, viewSta, viewDist).map((s) => {
        const p = world.toWorld(s, stationLabelOffset(world, s));
        return (
          <mesh key={s} position={[p.x, p.y + 0.9, p.z]} castShadow>
            <boxGeometry args={[0.3, 1.8, 0.3]} />
            <meshStandardMaterial color={s % 1000 === 0 ? '#3557e0' : '#ffffff'} />
          </mesh>
        );
      })}
    </>
  );
}

/** Ubica en pantalla las etiquetas HTML de LabelsLayer según la cámara */
function LabelProjector() {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const layer = document.getElementById(LABELS_LAYER_ID);
    if (!layer) return;
    for (const el of Array.from(layer.children) as HTMLElement[]) {
      v.set(Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.z)).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%)`;
      }
    }
  });
  return null;
}

function Entities({ world }: { world: World }) {
  const entities = useStore((s) => s.entities);
  return (
    <>
      {entities.map((e) => (
        <EntityView key={e.id} ent={e} world={world} />
      ))}
    </>
  );
}

function EntityView({ ent, world }: { ent: Entity; world: World }) {
  const selected = useStore((s) => s.selectedId === ent.id);
  const select = useStore((s) => s.select);
  const moveEntity = useStore((s) => s.moveEntity);
  const controls = useThree((s) => s.controls) as MapControlsImpl | null;
  const drag = useRef<Plane | null>(null);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  useCursor(hover || dragging, dragging ? 'grabbing' : 'grab');

  const p = world.toWorld(ent.sta, ent.off);
  const rotY = p.theta + (ent.facing < 0 ? Math.PI : 0);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    select(ent.id);
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    drag.current = new Plane(new Vector3(0, 1, 0), -p.y);
    setDragging(true);
    if (controls) controls.enabled = false;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    const hit = new Vector3();
    if (!e.ray.intersectPlane(drag.current, hit)) return;
    const st = world.locate(hit.x, hit.z, ent.sta, 300);
    moveEntity(ent.id, clamp(st.sta, world.staStart, world.staEnd), clamp(st.off, -55, 55));
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    drag.current = null;
    setDragging(false);
    if (controls) controls.enabled = true;
  };

  return (
    <group position={[p.x, p.y, p.z]}>
      <group
        rotation-y={rotY}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
      >
        <EntityModel type={ent.type} />
      </group>
      {(selected || hover) && <SelectionRing radius={FOOTPRINT[ent.type]} strong={selected} />}
    </group>
  );
}

function SelectionRing({ radius, strong }: { radius: number; strong: boolean }) {
  const ref = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    const k = strong ? 1 + Math.sin(clock.elapsedTime * 4) * 0.04 : 1;
    ref.current.scale.setScalar(k);
  });
  return (
    <mesh ref={ref} position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - (strong ? 0.45 : 0.25), radius, 48]} />
      <meshBasicMaterial color="#3557e0" transparent opacity={strong ? 0.95 : 0.55} depthWrite={false} />
    </mesh>
  );
}

/** Controles tipo mapa + vuelo a una abscisa + seguimiento de la abscisa en vista */
function CameraRig({ world }: { world: World }) {
  const fly = useStore((s) => s.flyRequest);
  const setView = useStore((s) => s.setView);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as MapControlsImpl | null;
  const anim = useRef<{ from: Vector3; to: Vector3; camFrom: Vector3; camTo: Vector3; t: number } | null>(null);
  const frame = useRef(0);
  const lastSta = useRef(world.staStart);

  useEffect(() => {
    if (!fly || !controls) return;
    const p = world.toWorld(fly.sta, fly.off);
    const to = new Vector3(p.x, p.y, p.z);
    let offset = camera.position.clone().sub(controls.target);
    if (fly.reframe || offset.length() > 1500) {
      const dist = 190;
      const right = new Vector3(Math.sin(p.theta), 0, Math.cos(p.theta));
      const fwd = new Vector3(Math.cos(p.theta), 0, -Math.sin(p.theta));
      offset = right.multiplyScalar(0.6 * dist).add(fwd.multiplyScalar(-0.45 * dist)).add(new Vector3(0, 0.62 * dist, 0));
    }
    const camTo = to.clone().add(offset);
    lastSta.current = fly.sta;
    if (fly.instant) {
      controls.target.copy(to);
      camera.position.copy(camTo);
      controls.update();
      anim.current = null;
    } else {
      anim.current = { from: controls.target.clone(), to, camFrom: camera.position.clone(), camTo, t: 0 };
    }
  }, [fly, controls, camera, world]);

  useFrame((_, dt) => {
    if (!controls) return;
    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + dt / 0.9);
      const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
      controls.target.lerpVectors(a.from, a.to, k);
      camera.position.lerpVectors(a.camFrom, a.camTo, k);
      controls.update();
      if (a.t >= 1) anim.current = null;
    }
    if (++frame.current % 6 !== 0) return;
    const t = controls.target;
    const st = world.locate(t.x, t.z, lastSta.current, 600);
    lastSta.current = st.sta;
    if (!a) {
      // mantener el centro de órbita sobre la superficie al desplazarse por la vía
      const gy = world.surfaceZ(st.sta, clamp(st.off, -55, 55)) - world.origin.z;
      const dy = (gy - t.y) * 0.3;
      if (Math.abs(dy) > 0.01) {
        t.y += dy;
        camera.position.y += dy;
      }
    }
    setView(st.sta, camera.position.distanceTo(t));
  });

  return (
    <MapControls
      makeDefault
      enableDamping
      dampingFactor={0.12}
      maxPolarAngle={1.32}
      minDistance={15}
      maxDistance={6000}
      zoomSpeed={1.2}
    />
  );
}
