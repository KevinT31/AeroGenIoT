import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STATE_COLORS, TwinPartId, TwinSceneModel } from "./twinSceneModel";
import { FaultIndicator, StatusBeacon } from "./Turbine3D";

interface PartProps {
  model: TwinSceneModel;
  paused: boolean;
  selected: TwinPartId | null;
  onSelect: (part: TwinPartId | null) => void;
  onHover: (part: TwinPartId | null) => void;
}

export const CONTROLLER_POS = new THREE.Vector3(2.6, 0, 1.2);
export const BATTERY_POS = new THREE.Vector3(5.4, 0, 2.6);
export const INVERTER_POS = new THREE.Vector3(8.2, 0, 4.0);
export const HOUSE_POS = new THREE.Vector3(13.5, 0, 6.5);

const usePick = (
  part: TwinPartId,
  selected: TwinPartId | null,
  onSelect: (part: TwinPartId | null) => void,
  onHover: (part: TwinPartId | null) => void,
) => ({
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

const selectGlow = (isSelected: boolean) =>
  isSelected ? { emissive: new THREE.Color("#28a4f2"), emissiveIntensity: 0.35 } : {};

/* ------------------------------------------------------------------ *
 * Procedural control-panel texture (screen + readout + LEDs + label)
 * ------------------------------------------------------------------ */
const buildPanelTexture = (title: string, accent: string, kind: "bars" | "wave" | "cells") => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Brushed faceplate
  ctx.fillStyle = "#dde6ee";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i += 3) {
    ctx.strokeStyle = i % 6 === 0 ? "rgba(120,140,160,0.12)" : "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  // Screen
  ctx.fillStyle = "#06121c";
  ctx.fillRect(24, 22, size - 48, 132);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 22, size - 48, 132);
  ctx.fillStyle = accent;
  if (kind === "bars") {
    for (let i = 0; i < 7; i += 1) {
      const h = 24 + (Math.sin(i * 1.7) + 1) * 42;
      ctx.fillRect(40 + i * 26, 142 - h, 16, h);
    }
  } else if (kind === "wave") {
    ctx.beginPath();
    for (let x = 0; x <= size - 60; x += 1) {
      const y = 88 + Math.sin(x * 0.09) * 36;
      if (x === 0) ctx.moveTo(34 + x, y);
      else ctx.lineTo(34 + x, y);
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();
  } else {
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        ctx.fillStyle = c < 3 ? accent : "#1f6e58";
        ctx.fillRect(40 + c * 44, 44 + r * 52, 34, 38);
      }
    }
  }
  // Label
  ctx.fillStyle = "#1b2a38";
  ctx.font = "bold 36px Arial";
  ctx.fillText(title, 26, 200);
  ctx.fillStyle = "#5a6b7a";
  ctx.font = "16px Arial";
  ctx.fillText("AURORA NOCTUA", 26, 224);
  // Status LEDs
  ["#2bd47a", accent, "#f4b655"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(size - 70 + i * 22, 218, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const usePanelTexture = (title: string, accent: string, kind: "bars" | "wave" | "cells") => {
  const tex = useMemo(() => buildPanelTexture(title, accent, kind), [title, accent, kind]);
  useLayoutEffect(() => () => tex.dispose(), [tex]);
  return tex;
};

/** Small concrete pad each ground device sits on. */
const Pad = ({ size }: { size: [number, number, number] }) => (
  <mesh position={[0, 0.05, 0]} receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color="#9aa0a6" roughness={0.95} metalness={0.02} />
  </mesh>
);

/** Controller / MPPT charge regulator cabinet next to the tower. */
const ControllerBox = ({ model, selected, onSelect, onHover }: PartProps) => {
  const pick = usePick("controller", selected, onSelect, onHover);
  const panel = usePanelTexture("MPPT", "#4fd0c0", "bars");
  return (
    <group position={CONTROLLER_POS.toArray()} {...pick}>
      <Pad size={[1.0, 0.1, 0.75]} />
      <mesh position={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.8, 1.1, 0.55]} />
        <meshStandardMaterial color="#9fb0c0" roughness={0.5} metalness={0.25} {...selectGlow(selected === "controller")} />
      </mesh>
      {/* Accent top stripe */}
      <mesh position={[0, 1.16, 0]}>
        <boxGeometry args={[0.82, 0.12, 0.57]} />
        <meshStandardMaterial color="#1f86c9" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Front control panel (textured) */}
      <mesh position={[0, 0.7, 0.281]}>
        <planeGeometry args={[0.64, 0.84]} />
        <meshStandardMaterial map={panel} emissive="#ffffff" emissiveMap={panel} emissiveIntensity={0.5} roughness={0.55} toneMapped={false} />
      </mesh>
      {/* Side cooling vents */}
      {[-0.12, 0, 0.12].map((y) => (
        <mesh key={y} position={[0.401, 0.65 + y, 0]}>
          <boxGeometry args={[0.01, 0.05, 0.4]} />
          <meshStandardMaterial color="#5a6b7a" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
      <StatusBeacon model={model} part="controller" position={[0.26, 1.1, 0.3]} size={0.07} />
      <FaultIndicator model={model} part="controller" position={[0, 0.06, 0]} radius={0.78} />
    </group>
  );
};

/** Battery bank with a vertical state-of-charge gauge. */
const BatteryBank = ({ model, selected, onSelect, onHover }: PartProps) => {
  const pick = usePick("battery", selected, onSelect, onHover);
  const panel = usePanelTexture("48V", "#5ad1a6", "cells");
  const fillRef = useRef<THREE.Mesh>(null);
  const socHeight = Math.max(0.04, model.batterySoc * 0.9);
  const socColor =
    model.partStates.battery === "critical" ? STATE_COLORS.critical : model.batterySoc < 0.35 ? STATE_COLORS.warning : STATE_COLORS.normal;
  useFrame(({ clock }) => {
    if (!fillRef.current) return;
    const mat = fillRef.current.material as THREE.MeshStandardMaterial;
    // Breathing glow while charging, steady otherwise.
    mat.emissiveIntensity = model.batteryFlow < -0.05 ? 0.8 + 0.5 * Math.sin(clock.elapsedTime * 3) : 0.7;
  });
  return (
    <group position={BATTERY_POS.toArray()} {...pick}>
      <Pad size={[1.6, 0.1, 1.05]} />
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.3, 1.2, 0.8]} />
        <meshStandardMaterial color="#5e7385" roughness={0.5} metalness={0.22} {...selectGlow(selected === "battery")} />
      </mesh>
      {/* Cell-bank label panel */}
      <mesh position={[-0.32, 0.72, 0.401]}>
        <planeGeometry args={[0.5, 0.84]} />
        <meshStandardMaterial map={panel} emissive="#ffffff" emissiveMap={panel} emissiveIntensity={0.35} roughness={0.55} toneMapped={false} />
      </mesh>
      {/* SOC gauge window */}
      <mesh position={[0.42, 0.72, 0.401]}>
        <planeGeometry args={[0.3, 0.96]} />
        <meshStandardMaterial color="#07111c" emissive="#07111c" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={fillRef} position={[0.42, 0.72 - (0.9 - socHeight) / 2, 0.412]}>
        <planeGeometry args={[0.24, socHeight]} />
        <meshStandardMaterial color={socColor} emissive={socColor} emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      {/* Visible cell tops on the lid */}
      {[-0.42, -0.14, 0.14, 0.42].map((x) =>
        [-0.18, 0.18].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.32, z]}>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
            <meshStandardMaterial color="#33424f" roughness={0.5} metalness={0.4} />
          </mesh>
        )),
      )}
      {/* Terminals */}
      <mesh position={[-0.35, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 10]} />
        <meshStandardMaterial color="#e05757" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.35, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.12, 10]} />
        <meshStandardMaterial color="#4a87d6" metalness={0.6} roughness={0.3} />
      </mesh>
      <StatusBeacon model={model} part="battery" position={[0.0, 1.2, 0.42]} size={0.07} />
      <FaultIndicator model={model} part="battery" position={[0, 0.06, 0]} radius={1.0} />
    </group>
  );
};

/** Inverter cabinet (DC -> AC). */
const InverterBox = ({ model, selected, onSelect, onHover }: PartProps) => {
  const pick = usePick("inverter", selected, onSelect, onHover);
  const panel = usePanelTexture("DC→AC", "#53b6ff", "wave");
  const waveRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!waveRef.current) return;
    const mat = waveRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = model.houseFlow > 0 ? 0.8 + 0.4 * Math.sin(clock.elapsedTime * 6) : 0.15;
  });
  return (
    <group position={INVERTER_POS.toArray()} {...pick}>
      <Pad size={[1.1, 0.1, 0.7]} />
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.9, 1.0, 0.5]} />
        <meshStandardMaterial color="#b6c2cd" roughness={0.45} metalness={0.25} {...selectGlow(selected === "inverter")} />
      </mesh>
      {/* Accent stripe */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.92, 0.1, 0.52]} />
        <meshStandardMaterial color="#1f86c9" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Front control panel (textured) */}
      <mesh position={[0, 0.66, 0.251]}>
        <planeGeometry args={[0.72, 0.7]} />
        <meshStandardMaterial map={panel} emissive="#ffffff" emissiveMap={panel} emissiveIntensity={0.5} roughness={0.55} toneMapped={false} />
      </mesh>
      {/* AC wave indicator */}
      <mesh ref={waveRef} position={[0, 0.24, 0.26]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.1, 0.02, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#53b6ff" emissive="#53b6ff" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      {/* Heat fins */}
      {[-0.3, -0.15, 0, 0.15, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.6, -0.27]}>
          <boxGeometry args={[0.05, 0.8, 0.06]} />
          <meshStandardMaterial color="#8794a1" roughness={0.55} metalness={0.45} />
        </mesh>
      ))}
      <StatusBeacon model={model} part="inverter" position={[0.32, 1.02, 0.26]} size={0.07} />
      <FaultIndicator model={model} part="inverter" position={[0, 0.06, 0]} radius={0.72} />
    </group>
  );
};

/** The home being powered, with windows that glow when energy is delivered. */
const House3D = ({ model, selected, onSelect, onHover }: PartProps) => {
  const pick = usePick("house", selected, onSelect, onHover);
  const windowRefs = useRef<THREE.MeshStandardMaterial[]>([]);
  windowRefs.current = [];
  const registerWindow = (mat: THREE.MeshStandardMaterial | null) => {
    if (mat) windowRefs.current.push(mat);
  };
  useFrame(({ clock }) => {
    const base = model.housePowered ? 1.0 : 0.02;
    const flicker = model.houseFlicker ? 0.5 + 0.5 * Math.abs(Math.sin(clock.elapsedTime * 9)) : 1;
    windowRefs.current.forEach((mat) => {
      mat.emissiveIntensity = base * flicker;
    });
  });
  const windowColor = model.housePowered ? "#ffd778" : "#22303f";
  return (
    <group position={HOUSE_POS.toArray()} rotation={[0, -Math.PI / 7, 0]} {...pick}>
      {/* Walls */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[3.4, 2.0, 2.6]} />
        <meshStandardMaterial color="#c8b59a" roughness={0.8} metalness={0.05} {...selectGlow(selected === "house")} />
      </mesh>
      {/* Roof: 4-sided pyramid-ish gable */}
      <mesh position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[2.6, 1.3, 4]} />
        <meshStandardMaterial color="#7a4a3a" roughness={0.75} metalness={0.05} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.62, 1.31]}>
        <planeGeometry args={[0.62, 1.24]} />
        <meshStandardMaterial color="#54392c" roughness={0.7} />
      </mesh>
      {/* Windows */}
      {[
        [-1.05, 1.15, 1.31, 0],
        [1.05, 1.15, 1.31, 0],
        [-1.71, 1.15, 0.5, -Math.PI / 2],
      ].map(([x, y, z, ry], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, ry, 0]}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshStandardMaterial
            ref={registerWindow}
            color={windowColor}
            emissive="#ffc44d"
            emissiveIntensity={model.housePowered ? 1 : 0.02}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Chimney */}
      <mesh position={[1.0, 2.9, -0.5]}>
        <boxGeometry args={[0.35, 0.9, 0.35]} />
        <meshStandardMaterial color="#9b8674" roughness={0.8} />
      </mesh>
      <StatusBeacon model={model} part="house" position={[0, 3.5, 0]} size={0.09} />
      <FaultIndicator model={model} part="house" position={[0, 0.06, 0]} radius={2.1} />
    </group>
  );
};

/** A sagging cable between two ground points, with animated energy pulses. */
const EnergyCable = ({
  from,
  to,
  intensity,
  color,
  reverse = false,
  paused,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  intensity: number; // 0..1, 0 hides the pulses
  color: string;
  reverse?: boolean;
  paused: boolean;
}) => {
  const PULSES = 6;
  const pulsesRef = useRef<THREE.InstancedMesh>(null);
  const progress = useRef(0);
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.y = 0.06; // cable hugs the ground with a slight sag lift at ends
    const a = from.clone().setY(0.25);
    const b = to.clone().setY(0.25);
    return new THREE.CatmullRomCurve3([a, mid, b]);
  }, [from, to]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!pulsesRef.current) return;
    if (!paused) progress.current = (progress.current + delta * (0.25 + intensity * 0.85)) % 1;
    for (let i = 0; i < PULSES; i += 1) {
      let t = (progress.current + i / PULSES) % 1;
      if (reverse) t = 1 - t;
      const point = curve.getPointAt(t);
      dummy.position.copy(point);
      dummy.position.y += 0.05;
      const visible = intensity > 0.02;
      dummy.scale.setScalar(visible ? 0.07 + intensity * 0.05 : 0.0001);
      dummy.updateMatrix();
      pulsesRef.current.setMatrixAt(i, dummy.matrix);
    }
    pulsesRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 24, 0.035, 8, false]} />
        <meshStandardMaterial color="#16222f" roughness={0.6} metalness={0.3} />
      </mesh>
      <instancedMesh ref={pulsesRef} args={[undefined, undefined, PULSES]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>
    </group>
  );
};

export const Installation3D = (props: PartProps) => {
  const { model, paused } = props;
  const towerBase = useMemo(() => new THREE.Vector3(0.3, 0, 0.2), []);
  const batteryCharging = model.batteryFlow < -0.05;
  const batteryDelivering = model.batteryFlow > 0.05;
  return (
    <group>
      <ControllerBox {...props} />
      <BatteryBank {...props} />
      <InverterBox {...props} />
      <House3D {...props} />

      {/* Turbine -> controller: wind generation (cyan) */}
      <EnergyCable from={towerBase} to={CONTROLLER_POS} intensity={model.generationFlow} color="#5af3d7" paused={paused} />
      {/* Controller <-> battery: amber when charging, green pulses toward controller when delivering */}
      <EnergyCable
        from={CONTROLLER_POS}
        to={BATTERY_POS}
        intensity={batteryCharging ? Math.abs(model.batteryFlow) : batteryDelivering ? Math.abs(model.batteryFlow) : 0}
        color={batteryCharging ? "#f4b655" : "#2bd47a"}
        reverse={batteryDelivering}
        paused={paused}
      />
      {/* Controller -> inverter: combined DC bus */}
      <EnergyCable
        from={CONTROLLER_POS}
        to={INVERTER_POS}
        intensity={Math.max(model.generationFlow * 0.8, model.houseFlow * 0.8)}
        color="#53b6ff"
        paused={paused}
      />
      {/* Inverter -> house: AC delivery */}
      <EnergyCable from={INVERTER_POS} to={HOUSE_POS} intensity={model.houseFlow} color="#ffd778" paused={paused} />
    </group>
  );
};
