import { motion } from "framer-motion";
import type { DigitalTwinState } from "@/types/dashboard";
import { cn } from "@/utils/cn";

const strokeColors = {
  normal: "#2bd47a",
  warning: "#f4b655",
  critical: "#ff6678",
  offline: "#7a8496",
};

export type TwinAlertVisuals = {
  batteryLow: boolean;
  batteryCritical: boolean;
  batteryVoltageLow: boolean;
  batteryVoltageHigh: boolean;
  batteryDischargeHigh: boolean;
  batteryChargeHigh: boolean;
  batteryOvertemperature: boolean;
  controllerOverload: boolean;
  acVoltageLow: boolean;
  acVoltageHigh: boolean;
  acCurrentHigh: boolean;
  housePowerHigh: boolean;
  inverterOverload: boolean;
  inverterFault: boolean;
  supplyCut: boolean;
  inverterTempHigh: boolean;
  lowWind: boolean;
  highWind: boolean;
  vibrationHigh: boolean;
  vibrationCritical: boolean;
  rotorRpmOutOfRange: boolean;
};

type Props = {
  twin: DigitalTwinState;
  alertVisuals: TwinAlertVisuals;
  darkMode: boolean;
  compact?: boolean;
  activeWind: boolean;
  rotorSpeed: string;
  anemometerSpeed: string;
  showVibrationPulse: boolean;
  showThermalGlow: boolean;
  showElectricalFlow: boolean;
  cablePulseDuration: number;
  vaneRotation: number;
  housePowered: boolean;
  houseLightColor: string;
  powerCableColor: string;
  batteryCableColor: string;
  generatorCoreColor: string;
};

const BladeProfile = ({
  angle,
  stroke,
  opacity = 1,
  scale = 1,
}: {
  angle: number;
  stroke: string;
  opacity?: number;
  scale?: number;
}) => (
  <g transform={`rotate(${angle}) scale(${scale})`} opacity={opacity}>
    <path
      d="M0 0 C-14 -10 -22 -70 -18 -166 C-15 -256 14 -270 26 -196 C34 -128 22 -44 0 0 Z"
      fill="url(#bladeSurface)"
      stroke={stroke}
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <path d="M0 0 C4 -26 8 -78 7 -152" fill="none" stroke="rgba(255,255,255,0.54)" strokeWidth="2" strokeLinecap="round" />
  </g>
);

const GearWheel = ({
  x,
  y,
  radius,
  teeth,
  stroke,
  active,
  duration,
  reverse = false,
}: {
  x: number;
  y: number;
  radius: number;
  teeth: number;
  stroke: string;
  active: boolean;
  duration: number;
  reverse?: boolean;
}) => {
  const toothWidth = Math.max(6, radius * 0.16);
  const toothLength = Math.max(10, radius * 0.24);

  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g animate={active ? { rotate: reverse ? -360 : 360 } : { rotate: 0 }} transition={active ? { duration, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}>
        {Array.from({ length: teeth }).map((_, index) => (
          <rect
            key={`tooth-${x}-${y}-${index}`}
            x={-toothWidth / 2}
            y={-radius - toothLength + 2}
            width={toothWidth}
            height={toothLength}
            rx={toothWidth / 3}
            fill="url(#gearMetal)"
            stroke={stroke}
            strokeWidth="1.1"
            transform={`rotate(${(360 / teeth) * index})`}
          />
        ))}
        <circle r={radius} fill="url(#gearMetal)" stroke={stroke} strokeWidth="2.2" />
        <circle r={radius * 0.48} fill="rgba(255,255,255,0.18)" stroke={stroke} strokeWidth="1.8" />
        {Array.from({ length: 4 }).map((_, index) => (
          <rect key={`spoke-${x}-${y}-${index}`} x={-3.5} y={-radius * 0.88} width={7} height={radius * 0.94} rx={3.5} fill="rgba(210,222,236,0.68)" transform={`rotate(${index * 90})`} />
        ))}
      </motion.g>
    </g>
  );
};

const BatteryCell = ({
  x,
  y,
  polarity,
  stroke,
  chargeLevel,
  alertColor,
}: {
  x: number;
  y: number;
  polarity: "+" | "-";
  stroke: string;
  chargeLevel: number;
  alertColor: string;
}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect width="42" height="68" rx="10" fill="url(#batteryShell)" stroke={stroke} strokeWidth="1.8" />
    <rect x="12" y="-6" width="18" height="6" rx="3" fill="rgba(194,204,216,0.95)" stroke={stroke} strokeWidth="1.1" />
    <rect x="5" y={8 + (1 - chargeLevel) * 48} width="32" height={Math.max(8, chargeLevel * 48)} rx="7" fill={alertColor} opacity={0.78} />
    <text x="21" y="42" textAnchor="middle" fontSize="14" fontWeight="700" fill={stroke}>
      {polarity}
    </text>
  </g>
);

const AnemometerCup = ({ x, y, rotation }: { x: number; y: number; rotation: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotation})`}>
    <line x1="0" y1="0" x2="22" y2="0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M22 -8 C31 -8 36 -4 36 0 C36 4 31 8 22 8 C28 5 28 -5 22 -8 Z" fill="rgba(36,49,67,0.9)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </g>
);

const HeatWave = ({ x, y, color, delay = 0 }: { x: number; y: number; color: string; delay?: number }) => (
  <motion.path
    d={`M${x} ${y} C${x - 8} ${y - 10} ${x + 8} ${y - 20} ${x} ${y - 32} C${x - 9} ${y - 42} ${x + 9} ${y - 54} ${x} ${y - 66}`}
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    animate={{ opacity: [0.12, 0.82, 0.12], y: [0, -3, 0] }}
    transition={{ duration: 1.5, repeat: Infinity, delay }}
  />
);

export const TwinExactIllustration = ({
  twin,
  alertVisuals,
  darkMode,
  compact = false,
  activeWind,
  rotorSpeed,
  anemometerSpeed,
  showVibrationPulse,
  showThermalGlow,
  showElectricalFlow,
  cablePulseDuration,
  vaneRotation,
  housePowered,
  houseLightColor,
  powerCableColor,
  batteryCableColor,
  generatorCoreColor,
}: Props) => {
  const rotorStroke = strokeColors[twin.rotorStatus];
  const generatorStroke = strokeColors[twin.generatorStatus];
  const towerStroke = strokeColors[twin.towerStatus];
  const electricalStroke = strokeColors[twin.electricalStatus];
  const batteryStroke = strokeColors[twin.batteryStatus];
  const sensorsStroke = strokeColors[twin.sensorsStatus];
  const sceneOpacity = twin.connectivityStatus === "offline" ? 0.7 : 1;
  const rotorSpin = Math.max(0.78, Number(rotorSpeed.replace("s", "")) || 2.4);
  const cupSpin = Math.max(0.82, Number(anemometerSpeed.replace("s", "")) || 2);
  const vibrationOffset = alertVisuals.vibrationCritical ? 2.2 : alertVisuals.vibrationHigh ? 1.15 : 0;
  const livePowerFlow = showElectricalFlow || housePowered;
  const headOffsetX = 200;
  const rotorAssemblyX = 286 + headOffsetX;
  const shaftStartX = 336 + headOffsetX;
  const shaftEndX = 442 + headOffsetX;
  const nacelleOuterLeftX = 304 + headOffsetX;
  const nacelleShoulderLeftX = 330 + headOffsetX;
  const nacelleInnerLeftX = 362 + headOffsetX;
  const nacelleTopLineStartX = 374 + headOffsetX;
  const drivetrainX = 430 + headOffsetX;
  const drivetrainY = 232;
  const drivetrainWidth = 248;
  const drivetrainCenterX = drivetrainX + drivetrainWidth / 2;
  const drivetrainCenterY = 308;
  const generatorX = 714 + headOffsetX;
  const generatorY = 226;
  const nacelleEndX = 1048 + headOffsetX;
  const nacelleTopLineEndX = 1028 + headOffsetX;
  const controllerX = 908;
  const controllerY = 548;
  const controllerScale = 0.56;
  const controllerWidth = 184 * controllerScale;
  const controllerHeight = 136 * controllerScale;
  const controllerAlertX = controllerX - 8;
  const batteryX = 903;
  const batteryY = 666;
  const batteryScale = 0.7;
  const batteryWidth = 154 * batteryScale;
  const batteryHeight = 154 * batteryScale;
  const batteryAlertX = batteryX - 10;
  const inverterX = 890;
  const inverterY = 824;
  const inverterWidth = 140;
  const inverterHeight = 108;
  const inverterAlertX = inverterX - 10;
  const inverterGlowX = inverterX + inverterWidth / 2;
  const inverterGlowY = inverterY + inverterHeight / 2;
  const inverterOutputStartX = inverterX + inverterWidth;
  const inverterOutputStartY = inverterY + 86;
  const anemometerHubX = nacelleEndX - 46;
  const anemometerHubY = 90;
  const topAssemblyScale = 0.93;
  const topAssemblyPivotX = 946;
  const topAssemblyPivotY = 312;
  const topAssemblyBaseY = 438;
  const topAssemblyOffsetY = topAssemblyBaseY - (topAssemblyPivotY + (topAssemblyBaseY - topAssemblyPivotY) * topAssemblyScale);
  const topAssemblyTransform = `translate(0 ${topAssemblyOffsetY}) translate(${topAssemblyPivotX} ${topAssemblyPivotY}) scale(${topAssemblyScale}) translate(${-topAssemblyPivotX} ${-topAssemblyPivotY})`;
  const anemometerMountX = topAssemblyPivotX + (anemometerHubX - topAssemblyPivotX) * topAssemblyScale;
  const anemometerMountY = topAssemblyOffsetY + topAssemblyPivotY + (anemometerHubY - topAssemblyPivotY) * topAssemblyScale;
  const rotorBladeScaleX = activeWind ? 0.28 : 0.26;
  const rotorBladeProfileScale = 1.24;
  const dcTransferPath = "M960 622 V790 V872";
  const outputPath = `M${inverterOutputStartX} ${inverterOutputStartY} V1020 H1362 V986`;
  const chargeLevel = alertVisuals.batteryCritical ? 0.18 : alertVisuals.batteryLow ? 0.36 : twin.batteryStatus === "warning" ? 0.56 : 0.84;
  const batteryChargeColor = alertVisuals.batteryCritical ? "rgba(255,102,120,0.74)" : alertVisuals.batteryLow ? "rgba(244,182,85,0.72)" : "rgba(59,212,127,0.72)";
  const nacelleMotion = alertVisuals.highWind
    ? { x: [0, 1.8, -1.8, 0], rotate: [0, 0.28, -0.24, 0] }
    : showVibrationPulse
      ? { x: [0, -vibrationOffset, vibrationOffset, 0], y: [0, 1.1, -1.1, 0] }
      : { x: 0, y: 0, rotate: 0 };
  const nacelleTransition =
    alertVisuals.highWind || showVibrationPulse
      ? { duration: alertVisuals.highWind ? 1.5 : alertVisuals.vibrationCritical ? 0.28 : 0.42, repeat: Infinity, ease: "easeInOut" as const }
      : { duration: 0.25 };
  const generatorMotion =
    alertVisuals.vibrationCritical
      ? { x: [0, -1.4, 1.4, -1.1, 0], y: [0, 0.7, -0.7, 0.35, 0] }
      : alertVisuals.vibrationHigh || showVibrationPulse
        ? { x: [0, -0.75, 0.75, 0], y: [0, 0.35, -0.35, 0] }
        : activeWind
          ? { x: [0, -0.22, 0.22, 0], y: [0, 0.1, -0.1, 0] }
          : { x: 0, y: 0 };
  const generatorTransition =
    alertVisuals.vibrationCritical
      ? { duration: 0.32, repeat: Infinity, ease: "easeInOut" as const }
      : alertVisuals.vibrationHigh || showVibrationPulse
        ? { duration: 0.52, repeat: Infinity, ease: "easeInOut" as const }
        : activeWind
          ? { duration: 1.28, repeat: Infinity, ease: "easeInOut" as const }
          : { duration: 0.2 };
  const scenePalette = darkMode
    ? {
        bgStart: "#0c1c2c",
        bgMid: "#10263c",
        bgEnd: "#091523",
        outerStroke: "rgba(119,145,178,0.5)",
        floorShadow: "rgba(5,11,20,0.52)",
        windStrong: "rgba(108,192,255,0.42)",
        windMedium: "rgba(108,192,255,0.24)",
        windSoft: "rgba(108,192,255,0.14)",
        rotorAura: "rgba(116,179,235,0.12)",
        nacelleFill: "rgba(226,239,255,0.08)",
        nacelleStroke: "rgba(130,160,194,0.72)",
        nacelleTopLine: "rgba(255,255,255,0.18)",
        nacelleMidLine: "rgba(185,205,230,0.18)",
        drivetrainFill: "rgba(20,34,52,0.72)",
        controllerFill: "rgba(24,38,58,0.92)",
        batteryRackFill: "rgba(22,35,54,0.84)",
        vaneNoseFill: "#445d79",
        vaneTailFill: "#dfe8f4",
        towerFill: "rgba(175,192,210,0.16)",
        towerShade: "rgba(255,255,255,0.08)",
        houseRoof: "#6987ac",
        houseFill: "rgba(18,28,42,0.92)",
        houseStroke: "#6d88ad",
      }
    : {
        bgStart: "#dcecff",
        bgMid: "#eef6ff",
        bgEnd: "#dae9fb",
        outerStroke: "rgba(169,192,217,0.9)",
        floorShadow: "rgba(70,90,122,0.15)",
        windStrong: "rgba(86,180,255,0.74)",
        windMedium: "rgba(86,180,255,0.54)",
        windSoft: "rgba(86,180,255,0.34)",
        rotorAura: "rgba(108,172,232,0.16)",
        nacelleFill: "rgba(255,255,255,0.48)",
        nacelleStroke: "rgba(175,191,211,0.96)",
        nacelleTopLine: "rgba(255,255,255,0.56)",
        nacelleMidLine: "rgba(164,182,204,0.56)",
        drivetrainFill: "rgba(246,250,255,0.58)",
        controllerFill: "rgba(230,238,248,0.92)",
        batteryRackFill: "rgba(251,253,255,0.82)",
        vaneNoseFill: "rgba(71,96,126,0.94)",
        vaneTailFill: "rgba(237,243,249,0.95)",
        towerFill: "rgba(217,227,239,0.94)",
        towerShade: "rgba(255,255,255,0.6)",
        houseRoof: "#617ea4",
        houseFill: "rgba(255,255,255,0.84)",
        houseStroke: "#5f84ab",
      };

  return (
    <svg viewBox="0 0 1620 1040" className={cn("relative z-10 w-full", compact ? "h-[470px]" : "h-[700px]")} style={{ opacity: sceneOpacity }}>
      <defs>
        <linearGradient id="sceneSky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={scenePalette.bgStart} />
          <stop offset="55%" stopColor={scenePalette.bgMid} />
          <stop offset="100%" stopColor={scenePalette.bgEnd} />
        </linearGradient>
        <linearGradient id="bladeSurface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7fbff" />
          <stop offset="60%" stopColor="#d8e2ee" />
          <stop offset="100%" stopColor="#95a8bf" />
        </linearGradient>
        <linearGradient id="gearMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef4fa" />
          <stop offset="60%" stopColor="#b5c1cf" />
          <stop offset="100%" stopColor="#78879a" />
        </linearGradient>
        <linearGradient id="hubShell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6f9fd" />
          <stop offset="100%" stopColor="#bcc8d7" />
        </linearGradient>
        <linearGradient id="nacelleGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={scenePalette.nacelleFill} />
          <stop offset="55%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
        </linearGradient>
        <linearGradient id="towerPaint" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={scenePalette.towerFill} />
          <stop offset="48%" stopColor={scenePalette.towerShade} />
          <stop offset="100%" stopColor={scenePalette.towerFill} />
        </linearGradient>
        <linearGradient id="batteryShell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eff4f9" />
          <stop offset="100%" stopColor="#9ba8ba" />
        </linearGradient>
        <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="10" y="10" width="1600" height="1020" rx="46" fill="url(#sceneSky)" stroke={scenePalette.outerStroke} strokeWidth="2.2" />
      <ellipse cx="946" cy="1016" rx="624" ry="18" fill={scenePalette.floorShadow} />

      {activeWind ? (
        <motion.g
          animate={{ opacity: alertVisuals.highWind ? [0.2, 0.42, 0.2] : alertVisuals.lowWind ? [0.05, 0.14, 0.05] : [0.1, 0.24, 0.1], x: alertVisuals.highWind ? [0, 18, 0] : [0, 9, 0] }}
          transition={{ duration: alertVisuals.highWind ? 0.8 : alertVisuals.lowWind ? 2.3 : 1.55, repeat: Infinity, ease: "linear" }}
        >
          <path d="M26 108 C176 52 338 60 520 134" fill="none" stroke={scenePalette.windMedium} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M44 168 C188 116 330 118 452 186" fill="none" stroke={scenePalette.windStrong} strokeWidth="4" strokeLinecap="round" />
          <path d="M18 208 C182 164 350 170 536 236" fill="none" stroke={scenePalette.windSoft} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M24 250 C180 220 326 224 448 278" fill="none" stroke={scenePalette.windMedium} strokeWidth="3.1" strokeLinecap="round" />
          <path d="M28 294 C186 268 352 276 530 340" fill="none" stroke={scenePalette.windSoft} strokeWidth="2" strokeLinecap="round" />
          <path d="M40 332 C176 304 316 308 430 352" fill="none" stroke={scenePalette.windSoft} strokeWidth="2.3" strokeLinecap="round" />
          <path d="M46 402 C214 378 374 388 548 450" fill="none" stroke={scenePalette.windSoft} strokeWidth="1.8" strokeLinecap="round" />
        </motion.g>
      ) : null}

      <motion.g animate={nacelleMotion} transition={nacelleTransition}>
        <path d="M914 438 H1010 L1058 1020 H864 Z" fill="url(#towerPaint)" stroke={towerStroke} strokeWidth="4" />
        <path d="M876 1020 H1048" fill="none" stroke={towerStroke} strokeWidth="5" strokeLinecap="round" />
        <g transform={topAssemblyTransform}>
        <g transform={`translate(${rotorAssemblyX} 312)`}>
          <motion.ellipse
            cx="0"
            cy="0"
            rx={alertVisuals.rotorRpmOutOfRange ? 82 : 64}
            ry={alertVisuals.rotorRpmOutOfRange ? 248 : 228}
            fill={alertVisuals.rotorRpmOutOfRange ? "rgba(255,102,120,0.12)" : scenePalette.rotorAura}
            filter="url(#softGlow)"
            animate={{ opacity: activeWind ? [0.12, 0.3, 0.12] : [0.03, 0.08, 0.03], scaleX: activeWind ? [0.9, 1, 0.9] : [0.94, 0.98, 0.94] }}
            transition={{ duration: Math.max(0.6, rotorSpin * 0.52), repeat: Infinity, ease: "linear" }}
          />
          <motion.g animate={showVibrationPulse ? { x: [0, -vibrationOffset, vibrationOffset, 0], y: [0, 0.45, -0.45, 0] } : { x: 0, y: 0 }} transition={showVibrationPulse ? { duration: alertVisuals.vibrationCritical ? 0.34 : 0.52, repeat: Infinity } : { duration: 0.2 }}>
            <g transform={`scale(${rotorBladeScaleX} 1)`}>
              <g>
                {activeWind ? <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur={`${rotorSpin}s`} repeatCount="indefinite" /> : null}
                <BladeProfile angle={0} stroke={rotorStroke} opacity={0.98} scale={rotorBladeProfileScale} />
                <BladeProfile angle={120} stroke={rotorStroke} opacity={0.84} scale={rotorBladeProfileScale} />
                <BladeProfile angle={240} stroke={rotorStroke} opacity={0.7} scale={rotorBladeProfileScale} />
              </g>
              <ellipse cx="-8" cy="0" rx="20" ry="24" fill="url(#hubShell)" stroke={rotorStroke} strokeWidth="2.8" />
              <ellipse cx="0" cy="0" rx="12" ry="16" fill="rgba(212,223,236,0.96)" stroke={rotorStroke} strokeWidth="2.2" />
            </g>
            <path
              d="M-6 -40 C-18 -32 -20 -22 -20 0 C-20 22 -18 32 -6 40 H18 C42 40 58 24 58 0 C58 -24 42 -40 18 -40 Z"
              fill="url(#hubShell)"
              stroke={rotorStroke}
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            <path d="M-10 -14 C2 -22 16 -22 28 -14" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.1" strokeLinecap="round" />
          </motion.g>
        </g>

        <path d={`M${shaftStartX} 312 H${shaftEndX}`} fill="none" stroke="url(#gearMetal)" strokeWidth="16" strokeLinecap="round" />

        <path d={`M${nacelleInnerLeftX} 188 H${nacelleEndX - 52} C${nacelleEndX - 24} 188 ${nacelleEndX} 212 ${nacelleEndX} 240 V380 C${nacelleEndX} 412 ${nacelleEndX - 26} 438 ${nacelleEndX - 58} 438 H${nacelleInnerLeftX} C${nacelleShoulderLeftX} 438 ${nacelleOuterLeftX} 412 ${nacelleOuterLeftX} 380 V246 C${nacelleOuterLeftX} 214 ${nacelleShoulderLeftX} 188 ${nacelleInnerLeftX} 188 Z`} fill="url(#nacelleGlass)" stroke={scenePalette.nacelleStroke} strokeWidth="5" />
        <path d={`M${nacelleTopLineStartX} 206 H${nacelleTopLineEndX}`} fill="none" stroke={scenePalette.nacelleTopLine} strokeWidth="2.6" strokeLinecap="round" />

        <g transform={`translate(${drivetrainX} ${drivetrainY})`}>
          <rect width="248" height="154" rx="22" fill={scenePalette.drivetrainFill} stroke={rotorStroke} strokeWidth="2.2" />
          <GearWheel x={78} y={76} radius={36} teeth={16} stroke={rotorStroke} active={activeWind} duration={Math.max(1.4, rotorSpin * 0.8)} />
          <GearWheel x={136} y={62} radius={26} teeth={14} stroke={rotorStroke} active={activeWind} duration={Math.max(1.1, rotorSpin * 0.68)} reverse />
          <GearWheel x={178} y={90} radius={18} teeth={10} stroke={rotorStroke} active={activeWind} duration={Math.max(0.9, rotorSpin * 0.54)} />
          <path d="M36 76 H212" fill="none" stroke="url(#gearMetal)" strokeWidth="10" strokeLinecap="round" />
        </g>

        {(showVibrationPulse || alertVisuals.vibrationHigh || alertVisuals.vibrationCritical) ? (
          <>
            <motion.circle cx={drivetrainCenterX} cy={drivetrainCenterY} r={alertVisuals.vibrationCritical ? "112" : "96"} fill="none" stroke={strokeColors[twin.vibrationStatus]} strokeWidth={alertVisuals.vibrationCritical ? "3.2" : "2.4"} animate={{ opacity: [0.05, 0.2, 0.05], scale: [1, 1.04, 1] }} transition={{ duration: alertVisuals.vibrationCritical ? 1 : 1.42, repeat: Infinity }} />
            <motion.circle cx={drivetrainCenterX} cy={drivetrainCenterY} r={alertVisuals.vibrationCritical ? "138" : "120"} fill="none" stroke={strokeColors[twin.vibrationStatus]} strokeWidth="1.8" animate={{ opacity: [0.03, 0.12, 0.03], scale: [0.99, 1.06, 0.99] }} transition={{ duration: alertVisuals.vibrationCritical ? 1.08 : 1.56, repeat: Infinity, delay: 0.2 }} />
          </>
        ) : null}

        <motion.g animate={generatorMotion} transition={generatorTransition}>
          <g transform={`translate(${generatorX} ${generatorY})`}>
            <rect width="252" height="164" rx="44" fill="rgba(197,129,78,0.08)" stroke={generatorStroke} strokeWidth="3.2" />
            <rect x="28" y="20" width="186" height="124" rx="30" fill="rgba(244,162,92,0.1)" stroke="rgba(231,154,82,0.78)" strokeWidth="2.4" />
            <path d="M14 82 H34" fill="none" stroke="url(#gearMetal)" strokeWidth="8" strokeLinecap="round" />
            <path d="M214 82 H236" fill="none" stroke="url(#gearMetal)" strokeWidth="8" strokeLinecap="round" />
            {Array.from({ length: 4 }).map((_, index) => <path key={`coil-left-${index}`} d={`M46 ${44 + index * 20} C58 ${34 + index * 20} 74 ${34 + index * 20} 86 ${44 + index * 20}`} fill="none" stroke="rgba(206,111,52,0.94)" strokeWidth="5.4" strokeLinecap="round" />)}
            {Array.from({ length: 4 }).map((_, index) => <path key={`coil-right-${index}`} d={`M156 ${44 + index * 20} C168 ${34 + index * 20} 184 ${34 + index * 20} 196 ${44 + index * 20}`} fill="none" stroke="rgba(206,111,52,0.94)" strokeWidth="5.4" strokeLinecap="round" />)}
            <rect x="92" y="28" width="56" height="108" rx="18" fill="rgba(230,236,244,0.94)" stroke="rgba(116,133,156,0.92)" strokeWidth="2.2" />
            {Array.from({ length: 8 }).map((_, index) => <path key={`rotor-lamination-${index}`} d={`M${100 + index * 6} 38 V126`} fill="none" stroke="rgba(132,146,166,0.82)" strokeWidth="2.2" strokeLinecap="round" />)}
            <ellipse cx="92" cy="82" rx="10" ry="54" fill="url(#gearMetal)" opacity="0.96" />
            <ellipse cx="148" cy="82" rx="10" ry="54" fill="url(#gearMetal)" opacity="0.96" />
            <path d="M72 28 C90 18 150 18 168 28" fill="none" stroke="rgba(255,214,171,0.72)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M72 136 C90 146 150 146 168 136" fill="none" stroke="rgba(255,214,171,0.56)" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </motion.g>
        </g>

        <g transform={`translate(${controllerX} ${controllerY}) scale(${controllerScale})`}>
          <rect width="184" height="136" rx="20" fill={scenePalette.controllerFill} stroke={electricalStroke} strokeWidth="3" />
          <rect x="48" y="24" width="88" height="88" rx="18" fill="rgba(230,238,247,0.78)" stroke="rgba(142,168,201,0.56)" strokeWidth="2.2" />
          <rect x="70" y="46" width="44" height="44" rx="10" fill="rgba(244,248,253,0.78)" stroke={electricalStroke} strokeWidth="2.4" filter="url(#softGlow)" />
          <path d="M58 34 H126" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
          {Array.from({ length: 4 }).map((_, index) => <path key={`chip-pin-top-${index}`} d={`M${76 + index * 10} 38 V46`} fill="none" stroke="rgba(111,148,195,0.88)" strokeWidth="2.4" strokeLinecap="round" />)}
          {Array.from({ length: 4 }).map((_, index) => <path key={`chip-pin-bottom-${index}`} d={`M${76 + index * 10} 90 V98`} fill="none" stroke="rgba(111,148,195,0.88)" strokeWidth="2.4" strokeLinecap="round" />)}
          {Array.from({ length: 4 }).map((_, index) => <path key={`chip-pin-left-${index}`} d={`M62 ${52 + index * 10} H70`} fill="none" stroke="rgba(111,148,195,0.88)" strokeWidth="2.4" strokeLinecap="round" />)}
          {Array.from({ length: 4 }).map((_, index) => <path key={`chip-pin-right-${index}`} d={`M114 ${52 + index * 10} H122`} fill="none" stroke="rgba(111,148,195,0.88)" strokeWidth="2.4" strokeLinecap="round" />)}
          <path d="M78 72 H86 L92 58 L98 76 L104 64 H112" fill="none" stroke="rgba(76,134,233,0.9)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="92" cy="58" r="2.4" fill="rgba(76,134,233,0.9)" />
          <circle cx="98" cy="76" r="2.4" fill="rgba(76,134,233,0.9)" />
          {Array.from({ length: 7 }).map((_, index) => <path key={`pin-left-${index}`} d={`M0 ${22 + index * 14} H20`} fill="none" stroke={electricalStroke} strokeWidth="3" strokeLinecap="round" />)}
          {Array.from({ length: 6 }).map((_, index) => <path key={`trace-bottom-${index}`} d={`M${52 + index * 16} 112 V136`} fill="none" stroke={electricalStroke} strokeWidth="3" strokeLinecap="round" />)}
        </g>
        {alertVisuals.controllerOverload ? <motion.rect x={controllerAlertX} y={controllerY - 8} width={controllerWidth + 16} height={controllerHeight + 16} rx="18" fill="none" stroke="rgba(255,170,79,0.92)" strokeWidth="4" strokeDasharray="10 10" animate={{ opacity: [0.18, 0.96, 0.18], scale: [1, 1.018, 1] }} transition={{ duration: 1, repeat: Infinity }} /> : null}

        {(alertVisuals.batteryDischargeHigh || alertVisuals.batteryChargeHigh) ? <motion.path d={dcTransferPath} fill="none" stroke={alertVisuals.batteryChargeHigh ? "rgba(23,194,157,0.96)" : "rgba(98,142,255,0.96)"} strokeWidth="3.6" strokeLinecap="round" strokeDasharray="12 16" animate={{ strokeDashoffset: alertVisuals.batteryChargeHigh ? [0, 38] : [38, 0], opacity: [0.18, 0.96, 0.18] }} transition={{ duration: 0.82, repeat: Infinity, ease: "linear" }} /> : null}
        <g transform={`translate(${batteryX} ${batteryY}) scale(${batteryScale})`}>
          <rect width="154" height="154" rx="24" fill={scenePalette.batteryRackFill} stroke={batteryStroke} strokeWidth="3" />
          <BatteryCell x={12} y={18} polarity="+" stroke={batteryStroke} chargeLevel={chargeLevel} alertColor={batteryChargeColor} />
          <BatteryCell x={56} y={18} polarity="-" stroke={batteryStroke} chargeLevel={chargeLevel} alertColor={batteryChargeColor} />
          <BatteryCell x={100} y={18} polarity="+" stroke={batteryStroke} chargeLevel={chargeLevel} alertColor={batteryChargeColor} />
          <BatteryCell x={12} y={88} polarity="-" stroke={batteryStroke} chargeLevel={chargeLevel} alertColor={batteryChargeColor} />
          <BatteryCell x={56} y={88} polarity="+" stroke={batteryStroke} chargeLevel={chargeLevel} alertColor={batteryChargeColor} />
          <BatteryCell x={100} y={88} polarity="-" stroke={batteryStroke} chargeLevel={chargeLevel} alertColor={batteryChargeColor} />
        </g>
        {(alertVisuals.batteryLow || alertVisuals.batteryCritical) ? <motion.rect x={batteryAlertX} y={batteryY - 8} width={batteryWidth + 20} height={batteryHeight + 20} rx="24" fill="none" stroke={alertVisuals.batteryCritical ? "#ff6678" : "#f4b655"} strokeWidth={alertVisuals.batteryCritical ? "4.2" : "3.2"} animate={{ opacity: [0.16, 0.92, 0.16], scale: [1, 1.024, 1] }} transition={{ duration: alertVisuals.batteryCritical ? 0.62 : 1.02, repeat: Infinity }} /> : null}
        {alertVisuals.batteryOvertemperature ? <><HeatWave x={batteryX + batteryWidth * 0.2} y={batteryY - 6} color="rgba(255,138,86,0.92)" /><HeatWave x={batteryX + batteryWidth * 0.5} y={batteryY - 12} color="rgba(255,138,86,0.78)" delay={0.22} /><HeatWave x={batteryX + batteryWidth * 0.8} y={batteryY - 6} color="rgba(255,138,86,0.92)" delay={0.38} /></> : null}
        {showThermalGlow ? <motion.ellipse cx={inverterGlowX} cy={inverterGlowY} rx="104" ry="76" fill={alertVisuals.inverterTempHigh ? "rgba(255,116,74,0.24)" : "rgba(255,152,88,0.18)"} filter="url(#softGlow)" animate={{ opacity: [0.18, 0.48, 0.18], scale: [0.98, 1.04, 0.98] }} transition={{ duration: 1.28, repeat: Infinity }} /> : null}

        <motion.g animate={alertVisuals.inverterFault ? { x: [0, -3, 3, -2, 0], opacity: [1, 0.88, 1, 0.82, 1] } : alertVisuals.inverterOverload ? { scale: [1, 1.02, 1] } : { x: 0, scale: 1, opacity: 1 }} transition={alertVisuals.inverterFault ? { duration: 0.34, repeat: Infinity } : alertVisuals.inverterOverload ? { duration: 0.82, repeat: Infinity } : { duration: 0.2 }}>
          <g transform={`translate(${inverterX} ${inverterY})`}>
            <rect width={inverterWidth} height={inverterHeight} rx="26" fill="rgba(84,128,182,0.08)" stroke={electricalStroke} strokeWidth="3.2" />
            <rect x="14" y="14" width="112" height="80" rx="18" fill="rgba(234,241,249,0.76)" stroke="rgba(143,171,204,0.62)" strokeWidth="1.8" />
            <rect x="22" y="22" width="34" height="20" rx="7" fill="rgba(244,248,253,0.92)" stroke="rgba(151,177,206,0.5)" strokeWidth="1.4" />
            <circle cx="32" cy="32" r="3.4" fill="rgba(43,212,122,0.92)" />
            <path d="M39 32 H50" fill="none" stroke="rgba(111,148,195,0.88)" strokeWidth="1.8" strokeLinecap="round" />
            <rect x="22" y="50" width="56" height="28" rx="10" fill="rgba(250,252,255,0.86)" stroke="rgba(151,177,206,0.46)" strokeWidth="1.4" />
            <path d="M30 64 H38 L44 56 L50 72 L58 60 H70" fill="none" stroke="rgba(76,134,233,0.92)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="86" y="24" width="30" height="56" rx="10" fill="rgba(222,231,242,0.74)" stroke="rgba(157,179,205,0.52)" strokeWidth="1.4" />
            {Array.from({ length: 5 }).map((_, index) => <path key={`inv-fin-${index}`} d={`M92 ${32 + index * 10} H110`} fill="none" stroke="rgba(124,149,181,0.88)" strokeWidth="2.4" strokeLinecap="round" />)}
            {Array.from({ length: 4 }).map((_, index) => <rect key={`inv-terminal-${index}`} x={26 + index * 18} y="96" width="10" height="6" rx="3" fill="rgba(169,191,218,0.86)" />)}
            <path d="M84 40 H94 M89 35 V45" fill="none" stroke="rgba(255,191,94,0.94)" strokeWidth="2.1" strokeLinecap="round" />
          </g>
        </motion.g>
        {alertVisuals.inverterOverload ? <motion.rect x={inverterAlertX} y={inverterY - 8} width={inverterWidth + 20} height={inverterHeight + 20} rx="30" fill="none" stroke="rgba(255,181,72,0.9)" strokeWidth="4" animate={{ opacity: [0.16, 0.9, 0.16], scale: [1, 1.018, 1] }} transition={{ duration: 0.78, repeat: Infinity }} /> : null}
        {alertVisuals.inverterFault ? <motion.g animate={{ opacity: [0.22, 0.96, 0.22] }} transition={{ duration: 0.52, repeat: Infinity }}><path d={`M${inverterX + 24} ${inverterY + 20} L${inverterX + inverterWidth - 24} ${inverterY + inverterHeight - 20}`} fill="none" stroke="rgba(255,102,120,0.86)" strokeWidth="4" strokeLinecap="round" /><path d={`M${inverterX + 24} ${inverterY + inverterHeight - 20} L${inverterX + inverterWidth - 24} ${inverterY + 20}`} fill="none" stroke="rgba(255,102,120,0.72)" strokeWidth="4" strokeLinecap="round" /></motion.g> : null}
        {alertVisuals.inverterTempHigh ? <><HeatWave x={inverterX + 26} y={inverterY - 4} color="rgba(255,138,70,0.92)" /><HeatWave x={inverterX + inverterWidth / 2} y={inverterY - 10} color="rgba(255,138,70,0.74)" delay={0.2} /><HeatWave x={inverterX + inverterWidth - 26} y={inverterY - 4} color="rgba(255,138,70,0.92)" delay={0.36} /></> : null}

        <g transform={`translate(${anemometerMountX} ${anemometerMountY})`}>
          <path
            d="M-8 98 C-10 66 -10 30 -6 10 C-4 4 -2 1 0 0"
            fill="none"
            stroke={sensorsStroke}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <motion.g
            transform="translate(0 0)"
            animate={activeWind ? { rotate: 360 } : { rotate: 0 }}
            transition={activeWind ? { duration: cupSpin, ease: "linear", repeat: Infinity } : { duration: 0.4 }}
            style={{ color: sensorsStroke }}
          >
            <AnemometerCup x={0} y={0} rotation={0} />
            <AnemometerCup x={0} y={0} rotation={120} />
            <AnemometerCup x={0} y={0} rotation={240} />
            <circle cx="0" cy="0" r="6.5" fill="rgba(36,49,67,0.94)" stroke={sensorsStroke} strokeWidth="2" />
          </motion.g>

          {alertVisuals.highWind ? (
            <motion.circle
              cx="0"
              cy="0"
              r="28"
              fill="none"
              stroke="rgba(255,181,72,0.9)"
              strokeWidth="3.2"
              strokeDasharray="8 10"
              animate={{ rotate: [0, 360], opacity: [0.12, 0.84, 0.12] }}
              transition={{ duration: 0.84, repeat: Infinity, ease: "linear" }}
            />
          ) : null}
        </g>
      </motion.g>

      <path d={outputPath} fill="none" stroke={powerCableColor} strokeWidth={alertVisuals.acCurrentHigh ? "7.6" : "6.2"} strokeLinecap="round" />
      {livePowerFlow ? (
        <motion.path
          d={outputPath}
          fill="none"
          stroke={alertVisuals.acCurrentHigh ? "rgba(255,177,68,0.96)" : "rgba(111,196,255,0.94)"}
          strokeWidth={alertVisuals.acCurrentHigh ? "3.3" : "2.5"}
          strokeLinecap="round"
          strokeDasharray={alertVisuals.acCurrentHigh ? "14 14" : "12 18"}
          animate={{ strokeDashoffset: [38, 0], opacity: [0.38, 0.96, 0.38] }}
          transition={{ duration: alertVisuals.acCurrentHigh ? 0.72 : cablePulseDuration, repeat: Infinity, ease: "linear" }}
        />
      ) : null}
      {alertVisuals.supplyCut ? (
        <motion.g animate={{ opacity: [0.18, 0.96, 0.18], scale: [1, 1.06, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
          <path d="M1446 868 L1474 900" fill="none" stroke="rgba(255,102,120,0.96)" strokeWidth="5" strokeLinecap="round" />
          <path d="M1474 868 L1446 900" fill="none" stroke="rgba(255,102,120,0.96)" strokeWidth="5" strokeLinecap="round" />
        </motion.g>
      ) : null}

      <g transform="translate(1200 724)">
        <path d="M8 138 L162 8 L318 138" fill="rgba(255,255,255,0.18)" stroke={scenePalette.houseRoof} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M34 138 H292 V274 H34 Z" fill={scenePalette.houseFill} stroke={scenePalette.houseStroke} strokeWidth="4" />
        <path d="M92 138 H232 V274" fill="none" stroke="rgba(155,178,206,0.18)" strokeWidth="2.2" />
        <rect x="58" y="164" width="56" height="56" rx="10" fill="rgba(204,220,239,0.12)" stroke="rgba(95,132,171,0.52)" strokeWidth="1.9" />
        <path d="M86 164 V220 M58 192 H114" fill="none" stroke="rgba(95,132,171,0.4)" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="206" y="176" width="54" height="98" rx="14" fill="rgba(196,210,228,0.1)" stroke="rgba(95,132,171,0.46)" strokeWidth="2" />

        {alertVisuals.acVoltageLow ? (
          <motion.path
            d="M62 208 C92 218 118 218 144 208 C166 200 190 200 216 208 C238 214 260 214 284 208"
            fill="none"
            stroke="rgba(255,188,92,0.92)"
            strokeWidth="4"
            strokeLinecap="round"
            animate={{ opacity: [0.2, 0.92, 0.2], y: [0, 3, 0] }}
            transition={{ duration: 1.04, repeat: Infinity }}
          />
        ) : null}
        {alertVisuals.acVoltageHigh ? (
          <motion.path
            d="M68 208 L90 190 L112 226 L134 184 L156 228 L178 186 L200 228 L222 190 L244 208"
            fill="none"
            stroke="rgba(255,102,120,0.9)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ opacity: [0.22, 0.98, 0.22] }}
            transition={{ duration: 0.58, repeat: Infinity }}
          />
        ) : null}

        {housePowered && alertVisuals.housePowerHigh ? (
          <motion.ellipse
            cx="162"
            cy="176"
            rx="122"
            ry="142"
            fill={houseLightColor}
            filter="url(#softGlow)"
            animate={{ opacity: [0.12, 0.34, 0.1, 0.3, 0.12], scale: [0.96, 1.14, 1, 1.1, 0.96] }}
            transition={{ duration: 0.72, repeat: Infinity }}
          />
        ) : null}
        <motion.ellipse
          cx="162"
          cy="176"
          rx={alertVisuals.housePowerHigh ? "98" : "84"}
          ry={alertVisuals.housePowerHigh ? "114" : "96"}
          fill={houseLightColor}
          filter="url(#softGlow)"
          animate={
            housePowered
              ? alertVisuals.housePowerHigh
                ? { opacity: [0.34, 0.82, 0.28, 0.76, 0.34], scale: [0.96, 1.12, 1, 1.08, 0.96] }
                : { opacity: [0.44, 0.92, 0.44], scale: [0.96, 1.08, 0.96] }
              : { opacity: 0.14, scale: 1 }
          }
          transition={{ duration: alertVisuals.housePowerHigh ? 0.68 : 1.18, repeat: Infinity }}
        />
        <path d="M162 108 C206 108 224 142 224 174 C224 210 200 238 184 248 V262 H140 V248 C124 238 100 210 100 174 C100 142 118 108 162 108 Z" fill="rgba(255,246,214,0.94)" stroke="#5d7594" strokeWidth="2.8" />
        <path d="M146 174 C152 162 172 162 178 174 C180 182 176 188 170 194 L170 214 H154 V194 C148 188 144 182 146 174 Z" fill="none" stroke="#a17928" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M154 214 H170 M150 228 H174 M148 240 H176 M150 252 H174" fill="none" stroke="#5d7594" strokeWidth="2.8" strokeLinecap="round" />
      </g>
    </svg>
  );
};
