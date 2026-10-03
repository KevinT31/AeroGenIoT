import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STATE_COLORS, TwinPartId, TwinSceneModel } from "./twinSceneModel";

export const TOWER_HEIGHT = 10;

type SelectHandler = (part: TwinPartId | null) => void;

interface PartProps {
  model: TwinSceneModel;
  paused: boolean;
  selected: TwinPartId | null;
  onSelect: SelectHandler;
  onHover: (part: TwinPartId | null) => void;
}

const useStatusMaterialProps = (model: TwinSceneModel, part: TwinPartId, selected: TwinPartId | null) => {
  const status = model.partStates[part];
  const color = STATE_COLORS[status];
  const isSelected = selected === part;
  return { status, color, isSelected };
};

/** Small emissive beacon used as a status light on each component. */
export const StatusBeacon = ({
  model,
  part,
  position,
  size = 0.12,
}: {
  model: TwinSceneModel;
  part: TwinPartId;
  position: [number, number, number];
  size?: number;
}) => {
  const ref = useRef<THREE.Mesh>(null);
  const color = STATE_COLORS[model.partStates[part]];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    const critical = model.partStates[part] === "critical";
    const pulse = 0.55 + 0.45 * Math.sin(clock.elapsedTime * (critical ? 7 : 2.2));
    mat.emissiveIntensity = critical ? 1.4 + pulse : 0.9 + pulse * 0.5;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} toneMapped={false} />
    </mesh>
  );
};

/**
 * Expanding "ping" ring that signals a warning/critical condition on a part.
 * Driven purely by the part's derived status (no synthetic data).
 */
export const FaultIndicator = ({
  model,
  part,
  position,
  radius = 0.6,
}: {
  model: TwinSceneModel;
  part: TwinPartId;
  position: [number, number, number];
  radius?: number;
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const state = model.partStates[part];
  const active = state === "warning" || state === "critical";
  const color = STATE_COLORS[state];
  useFrame(({ clock }) => {
    if (!active || !ringRef.current || !matRef.current) return;
    const speed = state === "critical" ? 1.4 : 0.8;
    const p = (clock.elapsedTime * speed) % 1;
    const s = 0.5 + p * 1.25;
    ringRef.current.scale.set(s, s, 1);
    matRef.current.opacity = (1 - p) * (state === "critical" ? 0.75 : 0.4);
  });
  if (!active) return null;
  return (
    <mesh ref={ringRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.82, radius, 40]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
};

/* ------------------------------------------------------------------ *
 * Rotor blade — extruded tapered airfoil (smooth, rounded tip)
 * ------------------------------------------------------------------ */
const BLADE_GEOMETRY = (() => {
  const len = 3.7;
  const shape = new THREE.Shape();
  // Outline in the rotor plane: wide root at y=0, sweeping to a slim rounded tip.
  shape.moveTo(-0.13, 0); // root leading edge
  shape.lineTo(0.17, 0); // root trailing edge
  shape.quadraticCurveTo(0.2, len * 0.45, 0.07, len * 0.85); // trailing edge sweep
  shape.quadraticCurveTo(0.035, len, -0.01, len); // rounded tip
  shape.quadraticCurveTo(-0.05, len * 0.9, -0.09, len * 0.5); // leading edge
  shape.quadraticCurveTo(-0.15, len * 0.18, -0.13, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    steps: 1,
  });
  geo.translate(0, 0.16, -0.05); // lift root past the hub, centre thickness on Z
  geo.computeVertexNormals();
  return geo;
})();

/** Smooth aerodynamic nose spinner (ogive), points toward +Z. */
const SPINNER_GEOMETRY = (() => {
  const pts: THREE.Vector2[] = [];
  const len = 0.66;
  const rMax = 0.3;
  const N = 16;
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    pts.push(new THREE.Vector2(Math.max(0.001, rMax * Math.sqrt(1 - t * t)), t * len));
  }
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateX(Math.PI / 2); // tip toward +Z
  geo.computeVertexNormals();
  return geo;
})();

/** Swept tail fin (veleta) — extruded with a rounded trailing edge. */
const VANE_GEOMETRY = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.18);
  s.quadraticCurveTo(0.55, -0.34, 1.15, -0.24);
  s.quadraticCurveTo(1.4, 0.05, 1.06, 0.5);
  s.quadraticCurveTo(0.5, 0.56, 0, 0.34);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 1,
    steps: 1,
  });
  geo.translate(0, -0.06, -0.025);
  geo.scale(0.48, 0.6, 1); // compact tail fin
  geo.rotateY(-Math.PI / 2); // fin stands vertical, length runs backward (-Z)
  geo.computeVertexNormals();
  return geo;
})();

const Blade = ({ angle }: { angle: number }) => (
  <group rotation={[0, 0, angle]}>
    {/* Airfoil, pitched a few degrees for a realistic twist */}
    <mesh geometry={BLADE_GEOMETRY} rotation={[0, 0.26, 0]} castShadow>
      <meshStandardMaterial color="#eef4fa" roughness={0.32} metalness={0.12} side={THREE.DoubleSide} />
    </mesh>
    {/* Root cuff into the hub */}
    <mesh position={[0, 0.16, 0]}>
      <cylinderGeometry args={[0.1, 0.13, 0.36, 14]} />
      <meshStandardMaterial color="#cfd9e2" roughness={0.4} metalness={0.2} />
    </mesh>
  </group>
);

/* ------------------------------------------------------------------ *
 * Weather station — wind-vane tail (direction) + 3-cup anemometer (speed)
 * ------------------------------------------------------------------ */
const Anemometer = ({ model, paused }: { model: TwinSceneModel; paused: boolean }) => {
  const spinRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spinRef.current && !paused) {
      spinRef.current.rotation.y += (0.5 + model.windSpeedMs * 0.8) * delta;
    }
  });
  return (
    <group position={[0, 0.6, -0.5]}>
      {/* Mast */}
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 0.52, 10]} />
        <meshStandardMaterial color="#aebccb" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Spinning cup head */}
      <mesh>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshStandardMaterial color="#8593a4" roughness={0.4} metalness={0.4} />
      </mesh>
      <group ref={spinRef}>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
          <group key={a} rotation={[0, a, 0]}>
            {/* Arm */}
            <mesh position={[0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.016, 0.016, 0.34, 8]} />
              <meshStandardMaterial color="#cdd8e2" roughness={0.4} metalness={0.45} />
            </mesh>
            {/* Cup (hemisphere catching the wind) */}
            <mesh position={[0.34, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <sphereGeometry args={[0.1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
              <meshStandardMaterial color="#eef4fa" roughness={0.35} metalness={0.18} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

export const Turbine3D = ({ model, paused, selected, onSelect, onHover }: PartProps) => {
  const rotorRef = useRef<THREE.Group>(null);
  const yawRef = useRef<THREE.Group>(null);
  const rotor = useStatusMaterialProps(model, "rotor", selected);
  const nacelle = useStatusMaterialProps(model, "nacelle", selected);
  const tower = useStatusMaterialProps(model, "tower", selected);
  const vane = useStatusMaterialProps(model, "vane", selected);

  const spinRate = useRef(0);
  useFrame(({ clock }, delta) => {
    // Smooth the blade speed toward the data-driven target (stable, no jumps).
    spinRate.current += (model.rotorSpeed - spinRate.current) * Math.min(1, delta * 1.5);
    if (rotorRef.current && !paused) {
      rotorRef.current.rotation.z -= spinRate.current * delta;
    }
    if (yawRef.current) {
      // Smoothly track the wind direction.
      const target = model.yawRad;
      const current = yawRef.current.rotation.y;
      let diff = target - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yawRef.current.rotation.y = current + diff * Math.min(1, delta * 1.5);

      // Vibration shake when the rotor / tower / nacelle reports a fault.
      const sev = (s: TwinSceneModel["overall"]) => (s === "critical" ? 2 : s === "warning" ? 1 : 0);
      const level = Math.max(sev(model.partStates.rotor), sev(model.partStates.tower), sev(model.partStates.nacelle));
      const amp = paused ? 0 : level === 2 ? 0.035 : level === 1 ? 0.013 : 0;
      const tt = clock.elapsedTime;
      yawRef.current.position.x = amp ? Math.sin(tt * 42) * amp : 0;
      yawRef.current.position.z = amp ? Math.cos(tt * 39) * amp : 0;
    }
  });

  const pick = (part: TwinPartId) => ({
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onSelect(selected === part ? null : part);
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onHover(part);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "auto";
    },
  });

  return (
    <group>
      {/* Tower */}
      <group {...pick("tower")}>
        <mesh position={[0, TOWER_HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.4, TOWER_HEIGHT, 18]} />
          <meshStandardMaterial
            color={tower.isSelected ? "#cfe6ff" : "#b9c6d4"}
            roughness={0.45}
            metalness={0.55}
            emissive={tower.isSelected ? "#28a4f2" : "#000000"}
            emissiveIntensity={tower.isSelected ? 0.25 : 0}
          />
        </mesh>
        {/* Base flange + status ring */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.62, 0.72, 0.24, 24]} />
          <meshStandardMaterial color="#8fa1b3" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 1.05, 40]} />
          <meshBasicMaterial color={STATE_COLORS[model.overall]} transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
        <FaultIndicator model={model} part="tower" position={[0, 0.08, 0]} radius={1.2} />
      </group>

      {/* Yaw group: nacelle + rotor + tail vane follow wind direction */}
      <group ref={yawRef} position={[0, TOWER_HEIGHT, 0]}>
        {/* Nacelle (generator housing) */}
        <group {...pick("nacelle")}>
          {/* capsule is vertical by default — rotate to lie along +Z (forward) */}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.34, 1.1, 8, 16]} />
            <meshStandardMaterial
              color={nacelle.isSelected ? "#d9ecff" : "#dde6ee"}
              roughness={0.35}
              metalness={0.35}
              emissive={nacelle.isSelected ? "#28a4f2" : "#000000"}
              emissiveIntensity={nacelle.isSelected ? 0.3 : 0}
            />
          </mesh>
          <StatusBeacon model={model} part="nacelle" position={[0, 0.48, 0]} size={0.1} />
          <FaultIndicator model={model} part="nacelle" position={[0, -0.5, 0]} radius={0.72} />
        </group>

        {/* Weather station: tail boom + swept wind vane + 3-cup anemometer */}
        <group {...pick("vane")}>
          {/* Tail boom */}
          <mesh position={[0, 0, -0.85]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.045, 1.15, 10]} />
            <meshStandardMaterial color="#9fb2c4" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* Swept vane tail (veleta) — small vertical fin that points the rotor into the wind */}
          <mesh geometry={VANE_GEOMETRY} position={[0, 0.16, -1.0]} castShadow>
            <meshStandardMaterial
              color={vane.isSelected ? "#6bc9ff" : "#1f86c9"}
              roughness={0.4}
              metalness={0.25}
              side={THREE.DoubleSide}
              emissive={vane.isSelected ? "#28a4f2" : "#0b3a5c"}
              emissiveIntensity={vane.isSelected ? 0.5 : 0.16}
            />
          </mesh>
          {/* Aurora racing stripe on each face of the fin */}
          {[0.04, -0.04].map((x) => (
            <mesh key={x} position={[x, 0.26, -1.32]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
              <planeGeometry args={[0.46, 0.04]} />
              <meshStandardMaterial color="#5af3d7" emissive="#33d7c7" emissiveIntensity={0.55} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <Anemometer model={model} paused={paused} />
          <StatusBeacon model={model} part="vane" position={[0.08, 0.4, -1.55]} size={0.06} />
          <FaultIndicator model={model} part="vane" position={[0, -0.18, -1.2]} radius={0.5} />
        </group>

        {/* Rotor: hub + 3 blades, spins on Z (facing +Z) */}
        <group position={[0, 0, 0.95]} {...pick("rotor")}>
          <group ref={rotorRef}>
            <mesh castShadow>
              <sphereGeometry args={[0.3, 18, 18]} />
              <meshStandardMaterial
                color={rotor.isSelected ? "#d9ecff" : "#ccd9e4"}
                roughness={0.3}
                metalness={0.45}
                emissive={rotor.isSelected ? "#28a4f2" : "#000000"}
                emissiveIntensity={rotor.isSelected ? 0.35 : 0}
              />
            </mesh>
            {/* Aerodynamic nose spinner */}
            <mesh geometry={SPINNER_GEOMETRY} position={[0, 0, 0.2]} castShadow>
              <meshStandardMaterial color="#eef4fa" roughness={0.25} metalness={0.45} />
            </mesh>
            <Blade angle={0} />
            <Blade angle={(Math.PI * 2) / 3} />
            <Blade angle={(Math.PI * 4) / 3} />
          </group>
          <StatusBeacon model={model} part="rotor" position={[0, -0.5, 0.1]} size={0.09} />
          <FaultIndicator model={model} part="rotor" position={[0, -0.62, 0]} radius={0.62} />
        </group>
      </group>
    </group>
  );
};
