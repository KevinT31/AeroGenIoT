import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TwinSceneModel } from "./twinSceneModel";

/* ------------------------------------------------------------------ *
 * Procedural altiplano terrain
 * ------------------------------------------------------------------ */

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Layered value noise (sum of sines) — cheap and deterministic. */
const fbm = (x: number, z: number) =>
  Math.sin(x * 0.08) * Math.cos(z * 0.07) +
  0.5 * Math.sin(x * 0.17 + 1.3) * Math.cos(z * 0.15 - 0.7) +
  0.25 * Math.sin(x * 0.31 - 2.1) * Math.cos(z * 0.29 + 0.4) +
  0.12 * Math.sin(x * 0.6 + 0.5) * Math.cos(z * 0.55);

/**
 * Height field around the installation: flat pad in the centre, gentle
 * rolling hills in the mid ring, and a rugged mountain skirt far out.
 */
export const terrainHeight = (x: number, z: number) => {
  const r = Math.hypot(x, z);
  const n = fbm(x, z); // ~ -1.9 .. 1.9
  const rolling = smoothstep(13, 32, r) * (1.3 + (n + 1.9) * 0.85);
  const ridge = 1 - Math.abs(fbm(x * 0.5 + 50, z * 0.5 - 30)); // 0..1 ridged
  const mountains = smoothstep(34, 80, r) * (5 + ridge * 9);
  return rolling + mountains;
};

type Stop = { h: number; c: THREE.Color };
const DAY_PALETTE: Stop[] = [
  { h: -1, c: new THREE.Color("#5f7d4f") },
  { h: 1.2, c: new THREE.Color("#6f8f5e") },
  { h: 3.0, c: new THREE.Color("#8c7a58") },
  { h: 6.0, c: new THREE.Color("#90898a") },
  { h: 9.0, c: new THREE.Color("#cfd6da") },
  { h: 13, c: new THREE.Color("#eef3f7") },
];
const NIGHT_PALETTE: Stop[] = [
  { h: -1, c: new THREE.Color("#142a20") },
  { h: 1.2, c: new THREE.Color("#17311f") },
  { h: 3.0, c: new THREE.Color("#2a2c30") },
  { h: 6.0, c: new THREE.Color("#2f3947") },
  { h: 9.0, c: new THREE.Color("#536a86") },
  { h: 13, c: new THREE.Color("#8ba2bf") },
];

const sampleColor = (h: number, palette: Stop[], out: THREE.Color) => {
  for (let i = 0; i < palette.length - 1; i += 1) {
    const a = palette[i];
    const b = palette[i + 1];
    if (h <= b.h) {
      const t = smoothstep(a.h, b.h, h);
      return out.copy(a.c).lerp(b.c, t);
    }
  }
  return out.copy(palette[palette.length - 1].c);
};

const buildTerrain = (dark: boolean) => {
  const size = 190;
  const seg = 150;
  const geometry = new THREE.PlaneGeometry(size, size, seg, seg);
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const palette = dark ? NIGHT_PALETTE : DAY_PALETTE;
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i); // becomes world Z after the -90° rotation
    const h = terrainHeight(x, y);
    pos.setZ(i, h);
    sampleColor(h, palette, tmp);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
};

/** Altiplano ground: sculpted terrain ring + a clean flat installation pad. */
export const Ground3D = ({ dark }: { dark: boolean }) => {
  const terrain = useMemo(() => buildTerrain(dark), [dark]);
  useLayoutEffect(() => () => terrain.dispose(), [terrain]);
  return (
    <group>
      <mesh geometry={terrain} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} metalness={0} />
      </mesh>
      {/* Flat pad the installation sits on */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 72]} />
        <meshStandardMaterial color={dark ? "#11212f" : "#8aa67d"} roughness={0.96} metalness={0.02} />
      </mesh>
      <polarGridHelper
        args={[13, 12, 6, 64, dark ? 0x1d3650 : 0x7a9a6e, dark ? 0x14283c : 0x88a87c]}
        position={[0, 0.02, 0]}
      />
      {/* Soft glow pad under the turbine */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[2.2, 40]} />
        <meshBasicMaterial color={dark ? "#10293f" : "#c2d8b5"} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

/* ------------------------------------------------------------------ *
 * Scattered scenery: boulders + grass tufts placed on the terrain
 * ------------------------------------------------------------------ */

// Tiny deterministic PRNG so the layout is stable across renders.
const makeRng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

type Instance = { pos: [number, number, number]; scale: [number, number, number]; rot: number };

const scatter = (count: number, rMin: number, rMax: number, seed: number, shape: "rock" | "grass"): Instance[] => {
  const rng = makeRng(seed);
  const out: Instance[] = [];
  for (let i = 0; i < count; i += 1) {
    const ang = rng() * Math.PI * 2;
    const r = rMin + rng() * (rMax - rMin);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const y = terrainHeight(x, z);
    if (shape === "rock") {
      const s = 0.4 + rng() * 1.4;
      out.push({ pos: [x, y + s * 0.3, z], scale: [s, s * (0.6 + rng() * 0.5), s], rot: rng() * Math.PI });
    } else {
      const s = 0.5 + rng() * 0.7;
      out.push({ pos: [x, y + s * 0.45, z], scale: [s * 0.5, s, s * 0.5], rot: rng() * Math.PI });
    }
  }
  return out;
};

const InstancedScatter = ({
  instances,
  children,
}: {
  instances: Instance[];
  children: React.ReactNode;
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    instances.forEach((it, i) => {
      dummy.position.set(...it.pos);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(...it.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [instances, dummy]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, instances.length]} castShadow receiveShadow frustumCulled={false}>
      {children}
    </instancedMesh>
  );
};

/** Boulders and grass tufts that dress the mid-distance terrain. */
export const Scenery3D = ({ dark }: { dark: boolean }) => {
  const rocks = useMemo(() => scatter(46, 16, 50, 1337, "rock"), []);
  const grass = useMemo(() => scatter(150, 14, 30, 7919, "grass"), []);
  return (
    <group>
      <InstancedScatter instances={rocks}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={dark ? "#2a3340" : "#7d7a72"} roughness={1} metalness={0.04} flatShading />
      </InstancedScatter>
      <InstancedScatter instances={grass}>
        <coneGeometry args={[0.4, 1, 5]} />
        <meshStandardMaterial color={dark ? "#1f3a26" : "#6b8a4e"} roughness={1} metalness={0} flatShading />
      </InstancedScatter>
    </group>
  );
};

/* ------------------------------------------------------------------ *
 * Wind streaks (drifting air) — unchanged behaviour
 * ------------------------------------------------------------------ */

export const WindStreaks3D = ({ model, paused, dark }: { model: TwinSceneModel; paused: boolean; dark: boolean }) => {
  const COUNT = 42;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        offset: Math.random() * 40,
        lateral: (Math.random() - 0.5) * 26,
        height: 4 + Math.random() * 9,
        scale: 0.5 + Math.random() * 1.1,
        speedJitter: 0.7 + Math.random() * 0.6,
      })),
    [],
  );
  const time = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (!paused) time.current += delta;
    const speed = 2 + model.windSpeedMs * 1.6;
    const yaw = model.yawRad;
    const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const visible = model.windLevel > 0.02;
    seeds.forEach((seed, i) => {
      const travel = ((time.current * speed * seed.speedJitter + seed.offset) % 44) - 22;
      dummy.position
        .copy(dir)
        .multiplyScalar(-travel)
        .addScaledVector(side, seed.lateral);
      dummy.position.y = seed.height;
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
      const len = visible ? seed.scale * (0.8 + model.windLevel * 2.4) : 0.0001;
      dummy.scale.set(0.03, 0.03, len);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={dark ? "#6bc9ff" : "#ffffff"} transparent opacity={dark ? 0.35 : 0.6} toneMapped={false} />
    </instancedMesh>
  );
};

/* ------------------------------------------------------------------ *
 * Distant mountain range with snow caps — silhouettes for grandeur
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Sky dome (vertical gradient) + sun / moon + night aurora
 * ------------------------------------------------------------------ */

/** Big inverted sphere with a smooth vertical gradient — day or night. */
export const Sky3D = ({ dark }: { dark: boolean }) => {
  const material = useMemo(() => {
    const top = new THREE.Color(dark ? "#02040a" : "#2f73bf");
    const mid = new THREE.Color(dark ? "#08152a" : "#9cc6ee");
    const bottom = new THREE.Color(dark ? "#0e2138" : "#dceaf7");
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { topColor: { value: top }, midColor: { value: mid }, botColor: { value: bottom } },
      vertexShader: `
        varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;
        void main(){
          float h = vDir.y;
          vec3 col = mix(midColor, topColor, pow(clamp(h, 0.0, 1.0), 0.7));
          col = mix(col, botColor, clamp(-h, 0.0, 1.0) * 0.7);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }, [dark]);
  useLayoutEffect(() => () => material.dispose(), [material]);
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[160, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

/** Sun by day, moon by night — a crisp disc with a soft halo. */
export const Celestial3D = ({ dark }: { dark: boolean }) => {
  const pos: [number, number, number] = dark ? [55, 62, -70] : [62, 58, -52];
  const core = dark ? "#e6eefb" : "#fff3d0";
  const halo = dark ? "#9fc2ff" : "#ffe39a";
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[dark ? 5 : 4.2, 32, 32]} />
        <meshBasicMaterial color={core} toneMapped={false} fog={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[dark ? 8.5 : 9.5, 32, 32]} />
        <meshBasicMaterial color={halo} transparent opacity={dark ? 0.16 : 0.22} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
};

const AURORA_VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const AURORA_FRAG = `
  varying vec2 vUv; uniform float uTime; uniform vec3 colorA; uniform vec3 colorB; uniform vec3 colorC;
  void main(){
    float v = vUv.y;
    float vert = smoothstep(0.0, 0.3, v) * (1.0 - smoothstep(0.6, 1.0, v));
    float u = vUv.x;
    float w1 = sin(u * 16.0 + uTime * 0.7) * 0.5 + 0.5;
    float w2 = sin(u * 6.0 - uTime * 0.45 + 1.7) * 0.5 + 0.5;
    float curtain = pow(clamp(w1 * 0.7 + w2 * 0.6, 0.0, 1.0), 2.2);
    float alpha = vert * curtain * 0.55;
    vec3 col = mix(colorA, colorB, w1);
    col = mix(col, colorC, w2 * 0.35);
    gl_FragColor = vec4(col, alpha);
  }`;

/** Flowing aurora curtains high in the night sky — the brand signature. */
export const Aurora3D = ({ paused }: { paused: boolean }) => {
  const mats = useRef<THREE.ShaderMaterial[]>([]);
  mats.current = [];
  const register = (m: THREE.ShaderMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m);
  };
  useFrame((_, delta) => {
    if (paused) return;
    mats.current.forEach((m) => {
      m.uniforms.uTime.value += delta;
    });
  });
  const bands = [
    { r: 96, h: 44, y: 34, theta: Math.PI * 1.2, rot: 0.2, seed: 0 },
    { r: 80, h: 36, y: 30, theta: Math.PI * 1.0, rot: 2.5, seed: 12 },
  ];
  return (
    <group>
      {bands.map((b, i) => (
        <mesh key={i} position={[0, b.y, 0]} rotation={[0, b.rot, 0]} frustumCulled={false}>
          <cylinderGeometry args={[b.r, b.r, b.h, 72, 1, true, 0, b.theta]} />
          <shaderMaterial
            ref={register}
            args={[
              {
                uniforms: {
                  uTime: { value: b.seed },
                  colorA: { value: new THREE.Color("#33d7c7") },
                  colorB: { value: new THREE.Color("#5af3d7") },
                  colorC: { value: new THREE.Color("#7a5cff") },
                },
                vertexShader: AURORA_VERT,
                fragmentShader: AURORA_FRAG,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
              },
            ]}
          />
        </mesh>
      ))}
    </group>
  );
};

export const Mountains3D = ({ dark }: { dark: boolean }) => {
  const peaks = useMemo(() => {
    const arr: { pos: [number, number, number]; r: number; h: number; cap: number; sides: number }[] = [];
    const N = 13;
    for (let i = 0; i < N; i += 1) {
      const ang = (i / N) * Math.PI * 2 + Math.sin(i * 2.3) * 0.22;
      const dist = 74 + (i % 4) * 8;
      const h = 19 + ((i * 37) % 15);
      arr.push({
        pos: [Math.cos(ang) * dist, 0, Math.sin(ang) * dist],
        r: h * (0.78 + (i % 3) * 0.08),
        h,
        cap: 0.28 + (i % 2) * 0.08,
        sides: 6 + (i % 2),
      });
    }
    return arr;
  }, []);

  const rockColor = dark ? "#13202c" : "#6f7c75";
  const snowColor = dark ? "#56697f" : "#eef4f8";

  return (
    <group>
      {peaks.map((peak, i) => {
        const capH = peak.h * peak.cap;
        return (
          <group key={i} position={peak.pos}>
            <mesh position={[0, peak.h / 2, 0]} castShadow={false}>
              <coneGeometry args={[peak.r, peak.h, peak.sides]} />
              <meshStandardMaterial color={rockColor} roughness={1} flatShading />
            </mesh>
            {/* Snow cap */}
            <mesh position={[0, peak.h - capH / 2, 0]}>
              <coneGeometry args={[peak.r * (capH / peak.h) * 1.15, capH, peak.sides]} />
              <meshStandardMaterial color={snowColor} roughness={0.85} flatShading />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
