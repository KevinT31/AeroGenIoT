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

const Blade = ({ angle, stroke }: { angle: number; stroke: string }) => (
  <g transform={`rotate(${angle} 280 320)`}>
    <path d="M280 320 C273 304 268 248 270 114 C272 68 288 68 290 114 C292 248 287 304 280 320 Z" fill="url(#bladeMetal)" stroke={stroke} strokeWidth="2.4" />
    <path d="M280 320 C283 299 285 250 283 138" fill="none" stroke="rgba(255,255,255,0.52)" strokeWidth="2.2" strokeLinecap="round" />
  </g>
);

const CupArm = ({ angle, stroke }: { angle: number; stroke: string }) => (
  <g transform={`rotate(${angle} 1354 92)`}>
    <path d="M1354 92 H1390" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="1398" cy="92" rx="12" ry="9" fill="rgba(33,42,56,0.92)" stroke={stroke} strokeWidth="2" />
  </g>
);

const BatteryCell = ({ x, y, polarity, stroke }: { x: number; y: number; polarity: "+" | "-"; stroke: string }) => (
  <g>
    <rect x={x} y={y} width="38" height="64" rx="9" fill="url(#batteryMetal)" stroke={stroke} strokeWidth="1.8" />
    <text x={x + 19} y={y + 41} textAnchor="middle" fontSize="14" fontWeight="700" fill={stroke}>
      {polarity}
    </text>
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
  const sceneOpacity = twin.connectivityStatus === "offline" ? 0.72 : 1;
  const rotorSpin = Math.max(0.9, Number(rotorSpeed.replace("s", "")) || 2.4);
  const cupSpin = Math.max(0.9, Number(anemometerSpeed.replace("s", "")) || 2);
  const vibrationOffset = alertVisuals.vibrationCritical ? 3.1 : 1.7;
  const livePowerFlow = showElectricalFlow || housePowered;
  const dcTransferPath = "M1240 320 C1208 322 1174 322 1140 320 C1106 318 1078 312 1048 306";
  const outputPath = "M1392 306 C1470 344 1522 426 1522 522 V838 C1522 876 1506 892 1474 892 H1432";
  const scenePalette = darkMode
    ? {
        bgStart: "#12253a",
        bgMid: "#0f2033",
        bgEnd: "#091523",
        outerStroke: "rgba(97,129,166,0.78)",
        floorShadow: "rgba(8,15,27,0.52)",
        windStrong: "rgba(108,192,255,0.34)",
        windMedium: "rgba(108,192,255,0.24)",
        windSoft: "rgba(108,192,255,0.14)",
        rotorAura: "rgba(84,154,220,0.12)",
        nacelleFill: "rgba(18,31,48,0.72)",
        nacelleStroke: "rgba(118,145,178,0.82)",
        nacelleTopLine: "rgba(222,236,252,0.12)",
        nacelleMidLine: "rgba(136,160,191,0.28)",
        drivetrainFill: "rgba(19,33,52,0.54)",
        controllerFill: "rgba(30,46,68,0.88)",
        batteryRackFill: "rgba(22,36,56,0.82)",
        vaneNoseFill: "rgba(82,107,138,0.9)",
        vaneTailFill: "rgba(191,208,228,0.84)",
        towerFill: "rgba(108,127,152,0.32)",
        houseFill: "rgba(16,25,39,0.86)",
        houseStroke: "#6d88ad",
      }
    : {
        bgStart: "#dcecff",
        bgMid: "#eef6ff",
        bgEnd: "#dae9fb",
        outerStroke: "rgba(163,190,220,0.94)",
        floorShadow: "rgba(70,90,122,0.15)",
        windStrong: "rgba(86,180,255,0.74)",
        windMedium: "rgba(86,180,255,0.54)",
        windSoft: "rgba(86,180,255,0.34)",
        rotorAura: "rgba(108,172,232,0.16)",
        nacelleFill: "rgba(255,255,255,0.48)",
        nacelleStroke: "rgba(175,191,211,0.96)",
        nacelleTopLine: "rgba(255,255,255,0.56)",
        nacelleMidLine: "rgba(164,182,204,0.56)",
        drivetrainFill: "rgba(248,252,255,0.35)",
        controllerFill: "rgba(217,230,244,0.85)",
        batteryRackFill: "rgba(245,249,255,0.78)",
        vaneNoseFill: "rgba(71,96,126,0.94)",
        vaneTailFill: "rgba(227,236,248,0.95)",
        towerFill: "rgba(205,218,232,0.9)",
        houseFill: "rgba(255,255,255,0.84)",
        houseStroke: "#5f84ab",
      };

  return (
    <svg viewBox="0 0 1620 1040" className={cn("relative z-10 w-full", compact ? "h-[470px]" : "h-[700px]")} style={{ opacity: sceneOpacity }}>
      <defs>
        <linearGradient id="bgFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={scenePalette.bgStart} />
          <stop offset="55%" stopColor={scenePalette.bgMid} />
          <stop offset="100%" stopColor={scenePalette.bgEnd} />
        </linearGradient>
        <linearGradient id="bladeMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f7fbff" />
          <stop offset="60%" stopColor="#d8e2ee" />
          <stop offset="100%" stopColor="#95a8bf" />
        </linearGradient>
        <linearGradient id="hubMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6f9fd" />
          <stop offset="100%" stopColor="#bcc8d7" />
        </linearGradient>
        <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#677689" />
          <stop offset="45%" stopColor="#e1e9f2" />
          <stop offset="100%" stopColor="#677588" />
        </linearGradient>
        <linearGradient id="batteryMetal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8eef5" />
          <stop offset="100%" stopColor="#8f9aab" />
        </linearGradient>
        <filter id="bulbGlow" x="-90%" y="-90%" width="280%" height="280%">
          <feGaussianBlur stdDeviation="16" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="10" y="10" width="1600" height="1020" rx="46" fill="url(#bgFill)" stroke={scenePalette.outerStroke} strokeWidth="2.4" />
      <ellipse cx="960" cy="1028" rx="620" ry="16" fill={scenePalette.floorShadow} />

      {activeWind ? (
        <motion.g animate={{ opacity: alertVisuals.highWind ? [0.18, 0.38, 0.18] : alertVisuals.lowWind ? [0.06, 0.14, 0.06] : [0.12, 0.26, 0.12], x: alertVisuals.highWind ? [0, 18, 0] : [0, 9, 0] }} transition={{ duration: alertVisuals.highWind ? 0.85 : alertVisuals.lowWind ? 2.4 : 1.55, repeat: Infinity, ease: "linear" }}>
          <path d="M38 178 C192 108 340 112 470 188" fill="none" stroke={scenePalette.windStrong} strokeWidth="4.2" strokeLinecap="round" />
          <path d="M22 260 C178 218 334 222 450 280" fill="none" stroke={scenePalette.windMedium} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M40 332 C178 304 324 312 438 360" fill="none" stroke={scenePalette.windSoft} strokeWidth="2.4" strokeLinecap="round" />
        </motion.g>
      ) : null}

      {activeWind ? (
        <motion.circle cx="280" cy="320" r={alertVisuals.rotorRpmOutOfRange ? "226" : "212"} fill="none" stroke={alertVisuals.rotorRpmOutOfRange ? "rgba(255,102,120,0.26)" : scenePalette.rotorAura} strokeWidth={alertVisuals.rotorRpmOutOfRange ? "20" : "9"} animate={{ opacity: [0.14, 0.36, 0.14], scale: [0.98, 1.02, 0.98] }} transition={{ duration: Math.max(0.6, rotorSpin * 0.55), repeat: Infinity, ease: "linear" }} />
      ) : null}

      <motion.g animate={showVibrationPulse ? { x: [0, -vibrationOffset, vibrationOffset, -vibrationOffset / 2, 0], y: [0, vibrationOffset / 2, -vibrationOffset / 2, 0, 0] } : { x: 0, y: 0 }} transition={showVibrationPulse ? { duration: alertVisuals.vibrationCritical ? 0.24 : 0.38, repeat: Infinity } : { duration: 0.2 }}>
        <motion.g animate={activeWind ? { scaleX: [0.84, 1, 0.84] } : { scaleX: 0.88 }} transition={{ duration: Math.max(0.5, rotorSpin * 0.55), ease: "linear", repeat: Infinity }} style={{ originX: "280px", originY: "320px" }}>
          <motion.g animate={activeWind ? { rotate: 360 } : { rotate: 0 }} transition={activeWind ? { duration: rotorSpin, ease: "linear", repeat: Infinity } : { duration: 0.4 }} style={{ originX: "280px", originY: "320px" }}>
            <Blade angle={0} stroke={rotorStroke} />
            <Blade angle={120} stroke={rotorStroke} />
            <Blade angle={240} stroke={rotorStroke} />
          </motion.g>
        </motion.g>
        <ellipse cx="284" cy="320" rx="42" ry="39" fill="url(#hubMetal)" stroke={rotorStroke} strokeWidth="3" />
        <path d="M304 320 H360" fill="none" stroke="url(#steel)" strokeWidth="15" strokeLinecap="round" />
      </motion.g>

      {alertVisuals.rotorRpmOutOfRange ? (
        <motion.circle cx="280" cy="320" r="246" fill="none" stroke="rgba(255,102,120,0.48)" strokeWidth="4" strokeDasharray="18 20" animate={{ rotate: [0, 360], opacity: [0.18, 0.52, 0.18] }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} style={{ originX: "280px", originY: "320px" }} />
      ) : null}

      <rect x="340" y="182" width="1060" height="252" rx="66" fill={scenePalette.nacelleFill} stroke={scenePalette.nacelleStroke} strokeWidth="6" />
      <path d="M420 214 H1308" fill="none" stroke={scenePalette.nacelleTopLine} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M356 368 H1374" fill="none" stroke={scenePalette.nacelleMidLine} strokeWidth="2.4" strokeLinecap="round" />

      <motion.g animate={showVibrationPulse ? { x: [0, -vibrationOffset, vibrationOffset, 0] } : { x: 0 }} transition={showVibrationPulse ? { duration: alertVisuals.vibrationCritical ? 0.24 : 0.38, repeat: Infinity } : { duration: 0.2 }}>
        <rect x="432" y="232" width="246" height="152" rx="24" fill={scenePalette.drivetrainFill} stroke={rotorStroke} strokeWidth="2.6" />
        <path d="M374 320 H432" fill="none" stroke="url(#steel)" strokeWidth="16" strokeLinecap="round" />
        <circle cx="502" cy="308" r="36" fill="rgba(189,172,110,0.26)" stroke="rgba(164,149,99,0.92)" strokeWidth="2.4" />
        <circle cx="568" cy="264" r="25" fill="rgba(202,207,216,0.22)" stroke="rgba(131,141,156,0.92)" strokeWidth="2.2" />
        <circle cx="618" cy="326" r="28" fill="rgba(184,190,202,0.18)" stroke="rgba(126,136,151,0.9)" strokeWidth="2.2" />
      </motion.g>

      {showVibrationPulse ? (
        <>
          <motion.circle cx="552" cy="306" r="108" fill="none" stroke={strokeColors[twin.vibrationStatus]} strokeWidth={alertVisuals.vibrationCritical ? "4" : "3"} animate={{ opacity: [0.08, 0.3, 0.08], scale: [1, 1.07, 1] }} transition={{ duration: alertVisuals.vibrationCritical ? 0.9 : 1.35, repeat: Infinity }} />
          <motion.circle cx="552" cy="306" r={alertVisuals.vibrationCritical ? "152" : "140"} fill="none" stroke={strokeColors[twin.vibrationStatus]} strokeWidth="2" animate={{ opacity: [0.04, 0.18, 0.04], scale: [0.98, 1.1, 0.98] }} transition={{ duration: alertVisuals.vibrationCritical ? 0.96 : 1.35, repeat: Infinity, delay: 0.18 }} />
        </>
      ) : null}

      {showThermalGlow ? (
        <motion.ellipse cx="830" cy="306" rx="152" ry="92" fill={alertVisuals.inverterTempHigh ? "rgba(255,108,58,0.26)" : "rgba(255,138,70,0.22)"} animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.98, 1.04, 0.98] }} transition={{ duration: 1.4, repeat: Infinity }} />
      ) : null}

      <motion.g animate={alertVisuals.inverterFault ? { x: [0, -3, 3, -2, 0], opacity: [1, 0.9, 1, 0.86, 1] } : alertVisuals.inverterOverload ? { scale: [1, 1.02, 1] } : { x: 0, opacity: 1, scale: 1 }} transition={alertVisuals.inverterFault ? { duration: 0.34, repeat: Infinity } : alertVisuals.inverterOverload ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }} style={{ originX: "870px", originY: "306px" }}>
        <rect x="748" y="228" width="244" height="158" rx="54" fill="rgba(191,117,62,0.08)" stroke={generatorStroke} strokeWidth="4" />
        <rect x="778" y="240" width="150" height="136" rx="28" fill="rgba(225,145,78,0.15)" stroke={generatorCoreColor} strokeWidth="2.8" />
        {Array.from({ length: 18 }).map((_, index) => <path key={`coil-${index}`} d={`M${790 + index * 7} 252 V364`} fill="none" stroke={generatorCoreColor} strokeWidth="3" strokeLinecap="round" />)}
        <ellipse cx="934" cy="306" rx="12" ry="62" fill="url(#steel)" />
      </motion.g>

      {alertVisuals.inverterOverload ? <motion.rect x="742" y="222" width="256" height="170" rx="60" fill="none" stroke="rgba(255,176,68,0.92)" strokeWidth="4" animate={{ opacity: [0.18, 0.88, 0.18], scale: [1, 1.02, 1] }} transition={{ duration: 0.78, repeat: Infinity }} /> : null}
      {alertVisuals.inverterFault ? <motion.g animate={{ opacity: [0.2, 0.9, 0.2] }} transition={{ duration: 0.52, repeat: Infinity }}><path d="M770 252 L968 360" fill="none" stroke="rgba(255,102,120,0.86)" strokeWidth="4" strokeLinecap="round" /><path d="M770 360 L968 252" fill="none" stroke="rgba(255,102,120,0.72)" strokeWidth="4" strokeLinecap="round" /></motion.g> : null}

      <rect x="1030" y="246" width="170" height="128" rx="18" fill={scenePalette.controllerFill} stroke={electricalStroke} strokeWidth="3" />
      <rect x="1088" y="280" width="52" height="52" rx="8" fill="rgba(30,38,52,0.96)" />
      {alertVisuals.controllerOverload ? <motion.rect x="1024" y="240" width="182" height="140" rx="22" fill="none" stroke="rgba(255,170,79,0.92)" strokeWidth="4" strokeDasharray="10 10" animate={{ opacity: [0.2, 0.95, 0.2], scale: [1, 1.02, 1] }} transition={{ duration: 1.1, repeat: Infinity }} /> : null}

      <rect x="1238" y="236" width="152" height="146" rx="22" fill={scenePalette.batteryRackFill} stroke={batteryStroke} strokeWidth="3" />
      <BatteryCell x={1252} y={252} polarity="+" stroke={batteryStroke} />
      <BatteryCell x={1294} y={252} polarity="-" stroke={batteryStroke} />
      <BatteryCell x={1336} y={252} polarity="+" stroke={batteryStroke} />
      <BatteryCell x={1252} y={322} polarity="-" stroke={batteryStroke} />
      <BatteryCell x={1294} y={322} polarity="+" stroke={batteryStroke} />
      <BatteryCell x={1336} y={322} polarity="-" stroke={batteryStroke} />

      {(alertVisuals.batteryLow || alertVisuals.batteryCritical) ? (
        <>
          <motion.rect x="1232" y="230" width="164" height="156" rx="26" fill="none" stroke={alertVisuals.batteryCritical ? "#ff6678" : "#f4b655"} strokeWidth={alertVisuals.batteryCritical ? "4.2" : "3.2"} animate={{ opacity: [0.16, 0.92, 0.16], scale: [1, 1.025, 1] }} transition={{ duration: alertVisuals.batteryCritical ? 0.62 : 1.05, repeat: Infinity }} />
          <motion.rect x="1248" y={alertVisuals.batteryCritical ? "352" : "328"} width="138" height={alertVisuals.batteryCritical ? "18" : "34"} rx="8" fill={alertVisuals.batteryCritical ? "rgba(255,102,120,0.36)" : "rgba(244,182,85,0.28)"} animate={{ opacity: [0.18, 0.86, 0.18] }} transition={{ duration: alertVisuals.batteryCritical ? 0.56 : 1.2, repeat: Infinity }} />
        </>
      ) : null}
      {alertVisuals.batteryVoltageLow ? <motion.path d="M1314 214 V178 M1298 196 L1314 178 L1330 196" fill="none" stroke="rgba(244,182,85,0.92)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" animate={{ opacity: [0.2, 0.94, 0.2], y: [0, 5, 0] }} transition={{ duration: 1, repeat: Infinity }} /> : null}
      {alertVisuals.batteryVoltageHigh ? <motion.path d="M1314 214 V178 M1298 196 L1314 178 L1330 196" fill="none" stroke="rgba(255,102,120,0.9)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" animate={{ opacity: [0.22, 0.98, 0.22], y: [4, -2, 4] }} transition={{ duration: 0.7, repeat: Infinity }} /> : null}
      {(alertVisuals.batteryDischargeHigh || alertVisuals.batteryChargeHigh) ? <motion.path d={dcTransferPath} fill="none" stroke={alertVisuals.batteryChargeHigh ? "rgba(20,184,166,0.96)" : "rgba(93,140,255,0.96)"} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="12 16" animate={{ strokeDashoffset: alertVisuals.batteryChargeHigh ? [0, 36] : [36, 0], opacity: [0.2, 0.96, 0.2] }} transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }} /> : null}
      {alertVisuals.batteryOvertemperature ? <><HeatWave x={1266} y={232} color="rgba(255,132,89,0.9)" /><HeatWave x={1314} y={226} color="rgba(255,132,89,0.72)" delay={0.2} /><HeatWave x={1360} y={232} color="rgba(255,132,89,0.9)" delay={0.35} /></> : null}
      {alertVisuals.inverterTempHigh ? <><HeatWave x={812} y={220} color="rgba(255,138,70,0.9)" /><HeatWave x={856} y={214} color="rgba(255,138,70,0.76)" delay={0.2} /><HeatWave x={900} y={220} color="rgba(255,138,70,0.9)" delay={0.38} /></> : null}

      <path d="M1318 206 C1318 164 1330 136 1354 124" fill="none" stroke={sensorsStroke} strokeWidth="3" />
      <path d="M1354 124 V92" fill="none" stroke={sensorsStroke} strokeWidth="3" />
      <motion.g animate={activeWind ? { rotate: 360 } : { rotate: 0 }} transition={activeWind ? { duration: cupSpin, ease: "linear", repeat: Infinity } : { duration: 0.4 }} style={{ originX: "1354px", originY: "92px" }}>
        <CupArm angle={0} stroke={sensorsStroke} />
        <CupArm angle={120} stroke={sensorsStroke} />
        <CupArm angle={240} stroke={sensorsStroke} />
      </motion.g>
      <circle cx="1354" cy="92" r="8" fill="rgba(36,46,62,0.94)" stroke={sensorsStroke} strokeWidth="2.2" />
      <path d="M1354 124 V156" fill="none" stroke={sensorsStroke} strokeWidth="2.8" />
      <motion.g animate={{ rotate: vaneRotation }} transition={{ duration: 0.8, ease: "easeInOut" }} style={{ originX: "1354px", originY: "156px" }}>
        <path d="M1354 156 H1396" fill="none" stroke={sensorsStroke} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M1396 156 L1378 148 L1378 164 Z" fill={scenePalette.vaneNoseFill} stroke={sensorsStroke} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M1354 156 L1316 170 L1316 142 Z" fill={scenePalette.vaneTailFill} stroke={sensorsStroke} strokeWidth="1.8" strokeLinejoin="round" />
      </motion.g>

      <path d="M910 446 H1014 L1058 1022 H866 Z" fill={scenePalette.towerFill} stroke={towerStroke} strokeWidth="4" />
      <path d={outputPath} fill="none" stroke={powerCableColor} strokeWidth={alertVisuals.acCurrentHigh ? "7.6" : "6.2"} strokeLinecap="round" />
      {livePowerFlow ? <motion.path d={outputPath} fill="none" stroke={alertVisuals.acCurrentHigh ? "rgba(255,177,68,0.96)" : "rgba(111,196,255,0.94)"} strokeWidth={alertVisuals.acCurrentHigh ? "3.3" : "2.4"} strokeLinecap="round" strokeDasharray={alertVisuals.acCurrentHigh ? "14 14" : "12 18"} animate={{ strokeDashoffset: [34, 0], opacity: [0.42, 0.94, 0.42] }} transition={{ duration: alertVisuals.acCurrentHigh ? 0.72 : cablePulseDuration, repeat: Infinity, ease: "linear" }} /> : null}
      {alertVisuals.supplyCut ? <motion.g animate={{ opacity: [0.2, 0.95, 0.2] }} transition={{ duration: 0.72, repeat: Infinity }}><path d="M1452 874 L1478 906" fill="none" stroke="rgba(255,102,120,0.96)" strokeWidth="5" strokeLinecap="round" /><path d="M1478 874 L1452 906" fill="none" stroke="rgba(255,102,120,0.96)" strokeWidth="5" strokeLinecap="round" /></motion.g> : null}

      <path d="M1210 860 L1364 730 L1518 860" fill="none" stroke={scenePalette.houseStroke} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M1234 860 H1494 V992 H1234 Z" fill={scenePalette.houseFill} stroke={scenePalette.houseStroke} strokeWidth="4" />
      {alertVisuals.acVoltageLow ? <motion.path d="M1248 924 C1274 932 1296 932 1320 924 C1340 918 1360 918 1384 924 C1406 930 1428 930 1452 924" fill="none" stroke="rgba(255,188,92,0.92)" strokeWidth="4" strokeLinecap="round" animate={{ opacity: [0.2, 0.92, 0.2], y: [0, 3, 0] }} transition={{ duration: 1.05, repeat: Infinity }} /> : null}
      {alertVisuals.acVoltageHigh ? <motion.path d="M1248 924 L1270 906 L1292 942 L1314 900 L1336 944 L1358 900 L1380 944 L1402 906 L1424 924" fill="none" stroke="rgba(255,102,120,0.9)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" animate={{ opacity: [0.22, 0.98, 0.22] }} transition={{ duration: 0.58, repeat: Infinity }} /> : null}

      <motion.ellipse cx="1364" cy="902" rx="68" ry="86" fill={houseLightColor} filter="url(#bulbGlow)" animate={housePowered ? alertVisuals.housePowerHigh ? { opacity: [0.5, 1, 0.42, 1, 0.5], scale: [0.94, 1.12, 0.98, 1.1, 0.94] } : { opacity: [0.5, 1, 0.5], scale: [0.96, 1.08, 0.96] } : { opacity: 0.18, scale: 1 }} transition={{ duration: alertVisuals.housePowerHigh ? 0.62 : 1.2, repeat: Infinity }} />
      <path d="M1364 836 C1402 836 1418 866 1418 892 C1418 924 1398 948 1382 956 V968 H1346 V956 C1330 948 1310 924 1310 892 C1310 866 1326 836 1364 836 Z" fill="rgba(255,246,212,0.92)" stroke="#566f8d" strokeWidth="2.8" />
      <path d="M1364 974 V1008 H980 V1028" fill="none" stroke={powerCableColor} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
};
