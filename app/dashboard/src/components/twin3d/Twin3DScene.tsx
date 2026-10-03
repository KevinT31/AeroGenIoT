import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Stars } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { TwinPartId, TwinSceneModel } from "./twinSceneModel";
import { Turbine3D, TOWER_HEIGHT } from "./Turbine3D";
import { Installation3D } from "./Installation3D";
import { Aurora3D, Celestial3D, Ground3D, Mountains3D, Scenery3D, Sky3D, WindStreaks3D } from "./Environment3D";

export type ViewPreset = "orbit" | "front" | "technical";

const CAMERA_PRESETS: Record<ViewPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  // 3/4 hero view framing the whole installation (turbine + cabinets + house).
  orbit: { position: [21, 12, 21], target: [5.5, 4.5, 3] },
  // Clean front elevation looking at the rotor face (rotor now faces +Z).
  front: { position: [0, 7.5, 27], target: [0, 6.5, 0] },
  // Isometric overview showing the full power chain layout from above.
  technical: { position: [17, 19, 25], target: [6.5, 1.5, 3] },
};

const CameraRig = ({
  preset,
  presetNonce,
  controlsRef,
}: {
  preset: ViewPreset;
  presetNonce: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) => {
  const { camera, size } = useThree();
  useEffect(() => {
    const { position, target } = CAMERA_PRESETS[preset];
    const aspect = size.width / Math.max(1, size.height);
    // Portrait phones need a wider framing: pull back and center on the whole installation.
    const zoomOut = aspect < 0.8 ? 1.75 : aspect < 1.1 ? 1.3 : 1;
    const targetVec = new THREE.Vector3(...target);
    if (aspect < 0.8 && preset === "orbit") targetVec.set(4, 5, 2);
    const positionVec = new THREE.Vector3(...position).sub(targetVec).multiplyScalar(zoomOut).add(targetVec);
    camera.position.copy(positionVec);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(targetVec);
      controls.update();
    } else {
      camera.lookAt(targetVec);
    }
  }, [preset, presetNonce, camera, controlsRef, size.width, size.height]);
  return null;
};

export interface Twin3DSceneProps {
  model: TwinSceneModel;
  dark: boolean;
  paused: boolean;
  autoRotate: boolean;
  view: ViewPreset;
  /** Bumped every time the user re-picks a preset, to re-apply the same view. */
  viewNonce: number;
  selected: TwinPartId | null;
  onSelect: (part: TwinPartId | null) => void;
  onHover: (part: TwinPartId | null) => void;
}

export const Twin3DScene = ({
  model,
  dark,
  paused,
  autoRotate,
  view,
  viewNonce,
  selected,
  onSelect,
  onHover,
}: Twin3DSceneProps) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: CAMERA_PRESETS.orbit.position, fov: 50, near: 0.1, far: 300 }}
      onPointerMissed={() => onSelect(null)}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={[dark ? "#050d16" : "#bcd9ef"]} />
      <fog attach="fog" args={[dark ? "#0a1830" : "#c4ddf0", 72, 175]} />

      {/* Gradient sky dome + sun/moon (drawn behind everything) */}
      <Sky3D dark={dark} />
      <Celestial3D dark={dark} />

      {/* Lighting: cold moonlight at night, warm sun by day */}
      <ambientLight intensity={dark ? 0.5 : 0.55} color={dark ? "#8db4e6" : "#ffffff"} />
      <directionalLight
        position={dark ? [14, 26, 12] : [20, 30, 12]}
        intensity={dark ? 1.5 : 1.6}
        color={dark ? "#b8d4ff" : "#fff4dc"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <hemisphereLight args={[dark ? "#1d3c60" : "#cfe8ff", dark ? "#0a1420" : "#52684a", dark ? 0.7 : 0.6]} />
      {/* Aurora-teal rim light, the brand accent */}
      <pointLight position={[-8, 14, 6]} intensity={dark ? 26 : 4} color="#33d7c7" distance={50} decay={2} />
      {/* Fill light so the turbine reads clearly against the night sky */}
      {dark && <pointLight position={[6, 12, 14]} intensity={30} color="#9fc2ff" distance={60} decay={2} />}

      {dark && <Stars radius={130} depth={45} count={3200} factor={4} saturation={0} fade speed={paused ? 0 : 0.6} />}
      {dark && <Aurora3D paused={paused} />}

      {/* Procedural reflections so metal parts read cleanly (no external HDR download). */}
      <Environment key={dark ? "night" : "day"} resolution={64} frames={1}>
        <Lightformer intensity={dark ? 0.5 : 1.4} position={[0, 10, 8]} scale={[16, 16, 1]} color={dark ? "#9fc2ff" : "#fff6e6"} />
        <Lightformer intensity={dark ? 0.25 : 0.5} position={[-10, 5, -6]} scale={[10, 10, 1]} color="#33d7c7" />
        <Lightformer intensity={dark ? 0.18 : 0.4} position={[9, 4, -9]} scale={[9, 9, 1]} color={dark ? "#1d3c60" : "#bcd9ef"} />
      </Environment>

      <Suspense fallback={null}>
        <Ground3D dark={dark} />
        <Mountains3D dark={dark} />
        <Scenery3D dark={dark} />
        <WindStreaks3D model={model} paused={paused} dark={dark} />
        <Turbine3D model={model} paused={paused} selected={selected} onSelect={onSelect} onHover={onHover} />
        <Installation3D model={model} paused={paused} selected={selected} onSelect={onSelect} onHover={onHover} />
      </Suspense>

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate && !paused}
        autoRotateSpeed={0.7}
        minDistance={4}
        maxDistance={70}
        maxPolarAngle={Math.PI / 2 - 0.04}
        makeDefault
      />
      <CameraRig preset={view} presetNonce={viewNonce} controlsRef={controlsRef} />
    </Canvas>
  );
};
