#!/usr/bin/env node
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, "../..");
const ROOT_DIR = path.resolve(BACKEND_DIR, "../..");
const MODEL_DIR = path.join(BACKEND_DIR, "models", "operational-ai");
const ARTIFACTS_DIR = path.join(ROOT_DIR, "artifacts", "operational-ai");
const DATASET_DIR = path.join(ARTIFACTS_DIR, "datasets");
const LOG_DIR = path.join(ARTIFACTS_DIR, "logs");

const FEATURE_NAMES = [
  "windSpeedMs",
  "windDirectionSin",
  "windDirectionCos",
  "powerW",
  "loadPowerW",
  "batteryPct",
  "batteryAutonomyEstimatedH",
  "genVoltageV",
  "genCurrentA",
  "outputVoltageAcV",
  "outputCurrentAcA",
  "outputPowerW",
  "vibrationRms",
  "genTempC",
  "rotorRpm",
  "tempSlopePerMin",
  "vibrationSlopePerMin",
  "batterySlopePerMin",
  "powerSlopePerMin",
  "windAvg",
  "windStd",
  "directionSpreadDeg",
  "powerAvg",
  "loadAvg",
  "rotorRpmAvg",
  "lowBatteryFlag",
  "overloadFlag",
  "inverterFaultFlag",
  "supplyCutFlag",
];

const FAULT_CLASSES = ["nominal_operation", "high_temp", "high_vibration", "low_battery", "overload"];

const DEFAULT_THRESHOLDS = {
  tempHighC: 70,
  vibrationHighRms: 6,
  batteryLowPct: 20,
  batteryCriticalPct: 10,
  housePowerHighW: 2200,
  acCurrentHighA: 12,
  acVoltageLowV: 190,
  batteryCurrentHighA: 24,
  rotorRpmHigh: 750,
};

const options = parseArgs(process.argv.slice(2));

await loadEnvFiles();
const thresholds = {
  tempHighC: envNumber("ALERT_GEN_TEMP_HIGH_C", DEFAULT_THRESHOLDS.tempHighC),
  vibrationHighRms: envNumber("ALERT_VIBRATION_HIGH_RMS", DEFAULT_THRESHOLDS.vibrationHighRms),
  batteryLowPct: envNumber("ALERT_BATTERY_LOW_PCT", DEFAULT_THRESHOLDS.batteryLowPct),
  batteryCriticalPct: envNumber("ALERT_BATTERY_CRITICAL_PCT", DEFAULT_THRESHOLDS.batteryCriticalPct),
  housePowerHighW: envNumber("ALERT_HOUSE_POWER_HIGH_W", DEFAULT_THRESHOLDS.housePowerHighW),
  acCurrentHighA: envNumber("ALERT_AC_CURRENT_HIGH_A", DEFAULT_THRESHOLDS.acCurrentHighA),
  acVoltageLowV: envNumber("ALERT_AC_VOLTAGE_LOW_V", DEFAULT_THRESHOLDS.acVoltageLowV),
  batteryCurrentHighA: envNumber("ALERT_BATTERY_DC_HIGH_A", DEFAULT_THRESHOLDS.batteryCurrentHighA),
  rotorRpmHigh: envNumber("ALERT_ROTOR_RPM_HIGH", DEFAULT_THRESHOLDS.rotorRpmHigh),
};
const horizonMinutes = envNumber("AI_FORECAST_HORIZON_MINUTES", 15);

await ensureDirs();

const dbPoints = options.skipDb ? [] : await loadDbPoints();
const csvPoints = options.skipCsv ? [] : await loadCsvPoints();
const points = normalizePointSet([...dbPoints, ...csvPoints]);

if (!points.length) {
  console.error("[operational-ai] No se encontro telemetria para generar datasets.");
  process.exit(1);
}

const grouped = groupByDevice(points);
const samples = buildSamples(grouped, horizonMinutes, thresholds);
const syntheticFaultSamples = buildSyntheticFaultSamples(samples.faultRows, thresholds);
const faultRows = [...samples.faultRows, ...syntheticFaultSamples];

await writeCsv(
  path.join(DATASET_DIR, "telemetry_points.csv"),
  points,
  [
    "deviceId",
    "timestamp",
    "windSpeedMs",
    "windDirectionDeg",
    "powerW",
    "loadPowerW",
    "batteryPct",
    "batteryAutonomyEstimatedH",
    "genVoltageV",
    "genCurrentA",
    "outputVoltageAcV",
    "outputCurrentAcA",
    "vibrationRms",
    "genTempC",
    "rotorRpm",
    "batteryAlertLow",
    "batteryAlertOverload",
    "batteryAlertOvertemp",
    "inverterAlertOverload",
    "inverterAlertFault",
    "inverterAlertSupplyCut",
    "source",
  ],
);
await writeCsv(path.join(DATASET_DIR, "fault_dataset.csv"), faultRows, [
  "deviceId",
  "timestamp",
  "label",
  "severity",
  "sampleSource",
  ...FEATURE_NAMES,
]);
await writeCsv(path.join(DATASET_DIR, "power_forecast_dataset.csv"), samples.powerRows, [
  "deviceId",
  "timestamp",
  "targetPowerW",
  "horizonMinutes",
  ...FEATURE_NAMES,
]);
await writeCsv(path.join(DATASET_DIR, "yaw_recommendation_dataset.csv"), samples.yawRows, [
  "deviceId",
  "timestamp",
  "targetYawDeg",
  "targetYawSin",
  "targetYawCos",
  "horizonMinutes",
  ...FEATURE_NAMES,
]);

if (options.datasetsOnly) {
  console.log(
    `[operational-ai] Datasets generados: telemetry=${points.length}, fault=${faultRows.length}, power=${samples.powerRows.length}, yaw=${samples.yawRows.length}`,
  );
  process.exit(0);
}

const model = trainModels({
  faultRows,
  powerRows: samples.powerRows,
  yawRows: samples.yawRows,
  telemetryCount: points.length,
  dbCount: dbPoints.length,
  csvCount: csvPoints.length,
  syntheticFaultCount: syntheticFaultSamples.length,
  horizonMinutes,
  thresholds,
});

const modelPath = path.join(MODEL_DIR, "operational-ai-models.json");
const metricsPath = path.join(LOG_DIR, "training-metrics.json");
await fs.writeFile(modelPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
await fs.writeFile(metricsPath, `${JSON.stringify(model.training, null, 2)}\n`, "utf8");

console.log(`[operational-ai] Modelo escrito en ${path.relative(ROOT_DIR, modelPath)}`);
console.log(`[operational-ai] Metricas escritas en ${path.relative(ROOT_DIR, metricsPath)}`);
console.log(
  `[operational-ai] datasets: telemetry=${points.length}, fault=${faultRows.length}, power=${samples.powerRows.length}, yaw=${samples.yawRows.length}`,
);
console.log(`[operational-ai] fault accuracy=${formatMetric(model.training.metrics.fault.validationAccuracy)}`);
console.log(`[operational-ai] power MAE=${formatMetric(model.training.metrics.power.validationMaeW)} W`);
console.log(`[operational-ai] yaw angular MAE=${formatMetric(model.training.metrics.yaw.validationAngularMaeDeg)} deg`);

function parseArgs(argv) {
  return {
    datasetsOnly: argv.includes("--datasets-only"),
    skipDb: argv.includes("--skip-db"),
    skipCsv: argv.includes("--skip-csv"),
  };
}

async function loadEnvFiles() {
  for (const name of [".env.floci", ".env", ".env.example"]) {
    const file = path.join(BACKEND_DIR, name);
    if (!existsSync(file)) continue;
    const text = await fs.readFile(file, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function ensureDirs() {
  await fs.mkdir(MODEL_DIR, { recursive: true });
  await fs.mkdir(DATASET_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
}

async function loadDbPoints() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const take = Math.max(100, Math.min(envNumber("AI_TRAINING_MAX_DB_ROWS", 6000), 50000));
    const rows = await prisma.sensorReading.findMany({
      orderBy: { timestamp: "desc" },
      take,
    });
    await prisma.$disconnect();
    return rows
      .reverse()
      .map((row) => ({
        deviceId: safeString(row.deviceId) || "AE-01",
        timestamp: normalizeTimestamp(row.timestamp),
        windSpeedMs: finiteOrNull(row.windSpeed),
        windDirectionDeg: normalizeDegrees(finiteOrNull(row.windDirectionDeg)),
        powerW: finiteOrNull(row.powerW),
        loadPowerW: finiteOrNull(row.loadPowerW),
        batteryPct: finiteOrNull(row.batteryPct),
        batteryAutonomyEstimatedH: finiteOrNull(row.batteryAutonomyEstimatedH),
        genVoltageV: finiteOrNull(row.genVoltageV),
        genCurrentA: finiteOrNull(row.genCurrentA),
        outputVoltageAcV: finiteOrNull(row.outputVoltageAcV),
        outputCurrentAcA: finiteOrNull(row.outputCurrentAcA),
        vibrationRms: finiteOrNull(row.vibrationRms),
        genTempC: finiteOrNull(row.genTempC),
        rotorRpm: finiteOrNull(row.rotorRpm),
        batteryAlertLow: toBool(row.batteryAlertLow),
        batteryAlertOverload: toBool(row.batteryAlertOverload),
        batteryAlertOvertemp: toBool(row.batteryAlertOvertemp),
        inverterAlertOverload: toBool(row.inverterAlertOverload),
        inverterAlertFault: toBool(row.inverterAlertFault),
        inverterAlertSupplyCut: toBool(row.inverterAlertSupplyCut),
        source: "mysql-sensor-reading",
      }))
      .filter((point) => point.timestamp);
  } catch (error) {
    console.warn(`[operational-ai] MySQL/Prisma no disponible, continuando con CSV: ${error.message}`);
    return [];
  }
}

async function loadCsvPoints() {
  const files = [
    path.join(ROOT_DIR, "pc_hybrid_telemetry_log.csv"),
    path.join(ROOT_DIR, "pc_simulated_hybrid_telemetry_log.csv"),
  ].filter((file) => existsSync(file));
  const points = [];

  for (const file of files) {
    const rows = parseCsv(await fs.readFile(file, "utf8"));
    for (const row of rows) {
      points.push({
        deviceId: safeString(row.device_id) || "csv-device",
        timestamp: normalizeTimestamp(row.event_time_utc || row.timestamp || row.ts),
        windSpeedMs: finiteOrNull(row.wind_speed_mps),
        windDirectionDeg: normalizeDegrees(finiteOrNull(row.wind_dir_deg)),
        powerW: finiteOrNull(row.battery_power_w ?? row.internal_generation_w),
        loadPowerW: finiteOrNull(row.house_power_consumption_w ?? row.house_demand_w),
        batteryPct: finiteOrNull(row.battery_soc_pct),
        batteryAutonomyEstimatedH: finiteOrNull(row.battery_autonomy_estimated_h),
        genVoltageV: finiteOrNull(row.battery_voltage_dc_v),
        genCurrentA: finiteOrNull(row.battery_current_dc_a),
        outputVoltageAcV: finiteOrNull(row.inverter_output_voltage_ac_v),
        outputCurrentAcA: finiteOrNull(row.inverter_output_current_ac_a),
        vibrationRms: finiteOrNull(row.motor_vibration),
        genTempC: finiteOrNull(row.inverter_temp_c),
        rotorRpm: finiteOrNull(row.blade_rpm),
        batteryAlertLow: toBool(row.battery_alert_low),
        batteryAlertOverload: toBool(row.battery_alert_overload),
        batteryAlertOvertemp: toBool(row.battery_alert_overtemp),
        inverterAlertOverload: toBool(row.inverter_alert_overload),
        inverterAlertFault: toBool(row.inverter_alert_fault),
        inverterAlertSupplyCut: toBool(row.inverter_alert_supply_cut),
        source: path.basename(file),
      });
    }
  }

  return points.filter((point) => point.timestamp);
}

function normalizePointSet(points) {
  const byKey = new Map();
  for (const point of points) {
    const key = `${point.deviceId}:${point.timestamp}`;
    if (!byKey.has(key)) byKey.set(key, point);
  }
  return [...byKey.values()].sort((left, right) => {
    const device = String(left.deviceId).localeCompare(String(right.deviceId));
    if (device !== 0) return device;
    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  });
}

function groupByDevice(points) {
  const groups = new Map();
  for (const point of points) {
    const key = point.deviceId || "unknown-device";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  }
  return groups;
}

function buildSamples(grouped, horizonMin, activeThresholds) {
  const faultRows = [];
  const powerRows = [];
  const yawRows = [];
  const horizonMs = horizonMin * 60 * 1000;

  for (const [deviceId, devicePoints] of grouped.entries()) {
    const rows = devicePoints.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
    for (let index = 0; index < rows.length; index += 1) {
      const current = rows[index];
      const currentTime = new Date(current.timestamp).getTime();
      const history = rows.slice(Math.max(0, index - 59), index + 1).reverse();
      const features = buildFeatureMap(history);
      const futureWindow = rows.filter((row) => {
        const ts = new Date(row.timestamp).getTime();
        return ts > currentTime && ts <= currentTime + horizonMs;
      });
      const fault = weakFaultLabel([current, ...futureWindow], activeThresholds);
      faultRows.push({
        deviceId,
        timestamp: current.timestamp,
        label: fault.label,
        severity: fault.severity,
        sampleSource: "weak-label",
        ...features,
      });

      const futurePower = nearestFuture(rows, index, horizonMs);
      if (futurePower) {
        const targetPowerW = effectivePowerW(futurePower);
        if (targetPowerW !== null) {
          powerRows.push({
            deviceId,
            timestamp: current.timestamp,
            targetPowerW,
            horizonMinutes: horizonMin,
            ...features,
          });
        }
      }

      if (futureWindow.length) {
        const targetYawDeg = circularMeanDeg(
          futureWindow
            .map((point) => point.windDirectionDeg)
            .filter((value) => value !== null),
        );
        if (targetYawDeg !== null) {
          yawRows.push({
            deviceId,
            timestamp: current.timestamp,
            targetYawDeg,
            targetYawSin: Math.sin((targetYawDeg * Math.PI) / 180),
            targetYawCos: Math.cos((targetYawDeg * Math.PI) / 180),
            horizonMinutes: horizonMin,
            ...features,
          });
        }
      }
    }
  }

  return { faultRows, powerRows, yawRows };
}

function buildSyntheticFaultSamples(faultRows, activeThresholds) {
  const bases = faultRows.filter((row) => row.label === "nominal_operation").slice(0, 500);
  const synthetic = [];
  const recipes = [
    {
      label: "high_temp",
      severity: "critical",
      apply(row, index) {
        row.genTempC = activeThresholds.tempHighC + 5 + (index % 8);
        row.tempSlopePerMin = 0.7;
        row.outputCurrentAcA = Math.max(row.outputCurrentAcA, activeThresholds.acCurrentHighA * 0.6);
      },
    },
    {
      label: "high_vibration",
      severity: "warning",
      apply(row, index) {
        row.vibrationRms = activeThresholds.vibrationHighRms + 0.7 + (index % 5) * 0.25;
        row.vibrationSlopePerMin = 0.18;
        row.rotorRpm = Math.max(row.rotorRpm, activeThresholds.rotorRpmHigh * 0.88);
      },
    },
    {
      label: "low_battery",
      severity: "warning",
      apply(row, index) {
        row.batteryPct = Math.max(4, activeThresholds.batteryLowPct - 2 - (index % 8));
        row.batterySlopePerMin = -0.25;
        row.lowBatteryFlag = 1;
      },
    },
    {
      label: "overload",
      severity: "critical",
      apply(row, index) {
        row.loadPowerW = activeThresholds.housePowerHighW + 120 + (index % 10) * 25;
        row.outputCurrentAcA = activeThresholds.acCurrentHighA + 0.5 + (index % 4) * 0.2;
        row.outputVoltageAcV = activeThresholds.acVoltageLowV - 7;
        row.outputPowerW = row.outputVoltageAcV * row.outputCurrentAcA;
        row.overloadFlag = 1;
      },
    },
  ];

  for (const recipe of recipes) {
    bases.forEach((base, index) => {
      const row = { ...base, label: recipe.label, severity: recipe.severity, sampleSource: "synthetic-stress" };
      recipe.apply(row, index);
      synthetic.push(row);
    });
  }

  return synthetic;
}

function buildFeatureMap(pointsNewestFirst) {
  const latest = pointsNewestFirst[0] || {};
  const recent = pointsNewestFirst.slice(0, 30);
  const windDirectionDeg = latest.windDirectionDeg ?? 0;
  const outputPowerW =
    latest.outputVoltageAcV !== null && latest.outputCurrentAcA !== null
      ? Math.max(0, latest.outputVoltageAcV * latest.outputCurrentAcA)
      : 0;
  const windDirections = recent.map((point) => point.windDirectionDeg).filter((value) => value !== null);
  const windMean = circularMeanDeg(windDirections);

  return normalizeFeatureObject({
    windSpeedMs: latest.windSpeedMs,
    windDirectionSin: Math.sin((windDirectionDeg * Math.PI) / 180),
    windDirectionCos: Math.cos((windDirectionDeg * Math.PI) / 180),
    powerW: effectivePowerW(latest),
    loadPowerW: latest.loadPowerW,
    batteryPct: latest.batteryPct,
    batteryAutonomyEstimatedH: latest.batteryAutonomyEstimatedH,
    genVoltageV: latest.genVoltageV,
    genCurrentA: latest.genCurrentA,
    outputVoltageAcV: latest.outputVoltageAcV,
    outputCurrentAcA: latest.outputCurrentAcA,
    outputPowerW,
    vibrationRms: latest.vibrationRms,
    genTempC: latest.genTempC,
    rotorRpm: latest.rotorRpm,
    tempSlopePerMin: slopePerMinute(pointsNewestFirst, (point) => point.genTempC, 30),
    vibrationSlopePerMin: slopePerMinute(pointsNewestFirst, (point) => point.vibrationRms, 30),
    batterySlopePerMin: slopePerMinute(pointsNewestFirst, (point) => point.batteryPct, 30),
    powerSlopePerMin: slopePerMinute(pointsNewestFirst, effectivePowerW, 30),
    windAvg: average(numbers(recent, (point) => point.windSpeedMs)),
    windStd: stdDev(numbers(recent, (point) => point.windSpeedMs)),
    directionSpreadDeg: windMean === null ? 180 : circularSpreadDeg(windDirections, windMean),
    powerAvg: average(numbers(recent, effectivePowerW)),
    loadAvg: average(numbers(recent, (point) => point.loadPowerW)),
    rotorRpmAvg: average(numbers(recent, (point) => point.rotorRpm)),
    lowBatteryFlag: latest.batteryAlertLow ? 1 : 0,
    overloadFlag: latest.batteryAlertOverload || latest.batteryAlertOvertemp || latest.inverterAlertOverload ? 1 : 0,
    inverterFaultFlag: latest.inverterAlertFault ? 1 : 0,
    supplyCutFlag: latest.inverterAlertSupplyCut ? 1 : 0,
  });
}

function trainModels(input) {
  const featureRows = [...input.faultRows, ...input.powerRows, ...input.yawRows];
  const featureStats = fitFeatureStats(featureRows);
  const faultSplit = splitRows(input.faultRows, 0.82);
  const powerSplit = splitRows(input.powerRows, 0.82);
  const yawSplit = splitRows(input.yawRows, 0.82);
  const fault = trainSoftmaxClassifier(faultSplit.train, featureStats);
  const power = trainRidgeRegression(powerSplit.train, "targetPowerW", featureStats, 0.35);
  const yawSin = trainRidgeRegression(yawSplit.train, "targetYawSin", featureStats, 0.2);
  const yawCos = trainRidgeRegression(yawSplit.train, "targetYawCos", featureStats, 0.2);

  const training = {
    trainedAt: new Date().toISOString(),
    data: {
      telemetryRows: input.telemetryCount,
      dbRows: input.dbCount,
      csvRows: input.csvCount,
      syntheticFaultRows: input.syntheticFaultCount,
      faultRows: input.faultRows.length,
      powerRows: input.powerRows.length,
      yawRows: input.yawRows.length,
      horizonMinutes: input.horizonMinutes,
      thresholds: input.thresholds,
    },
    metrics: {
      fault: evaluateFault(fault, faultSplit.validation, featureStats),
      power: evaluateRegression(power, powerSplit.validation, "targetPowerW", featureStats),
      yaw: evaluateYaw(yawSin, yawCos, yawSplit.validation, featureStats),
    },
  };

  return {
    schemaVersion: 1,
    modelFamily: "aurora-operational-ai",
    generatedBy: "app/backend/scripts/operational-ai/train-operational-ai.mjs",
    features: {
      names: FEATURE_NAMES,
      means: featureStats.means,
      stds: featureStats.stds,
      defaults: Object.fromEntries(FEATURE_NAMES.map((name) => [name, 0])),
    },
    fault: {
      type: "softmax_classifier",
      classes: fault.classes,
      weights: fault.weights,
      biases: fault.biases,
    },
    power: {
      type: "ridge_regression",
      horizonMinutes: input.horizonMinutes,
      weights: power.weights,
      bias: power.bias,
      residualStdW: training.metrics.power.validationRmseW || training.metrics.power.trainRmseW || 120,
      maxPowerW: envNumber("AI_MAX_POWER_W", 5000),
    },
    yaw: {
      type: "circular_ridge_regression",
      horizonMinutes: input.horizonMinutes,
      sinWeights: yawSin.weights,
      sinBias: yawSin.bias,
      cosWeights: yawCos.weights,
      cosBias: yawCos.bias,
      angularMaeDeg: training.metrics.yaw.validationAngularMaeDeg || training.metrics.yaw.trainAngularMaeDeg || 25,
    },
    training,
  };
}

function trainSoftmaxClassifier(rows, featureStats) {
  const classes = FAULT_CLASSES.filter((label) => rows.some((row) => row.label === label));
  const classIndex = new Map(classes.map((label, index) => [label, index]));
  const dimension = FEATURE_NAMES.length;
  const weights = classes.map(() => Array(dimension).fill(0));
  const biases = classes.map(() => 0);
  const counts = countBy(rows, "label");
  const totalRows = rows.length || 1;
  const classWeights = Object.fromEntries(
    classes.map((label) => [label, totalRows / (classes.length * Math.max(1, counts[label] || 0))]),
  );
  const trainingRows = deterministicShuffle(rows)
    .map((row) => ({
      x: standardizeRow(row, featureStats),
      y: classIndex.get(row.label),
      sampleWeight: classWeights[row.label] || 1,
    }))
    .filter((row) => row.y !== undefined);

  const epochs = 360;
  const regularization = 0.003;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const learningRate = 0.16 / Math.sqrt(1 + epoch * 0.025);
    const gradWeights = classes.map(() => Array(dimension).fill(0));
    const gradBiases = classes.map(() => 0);
    let totalWeight = 0;

    for (const row of trainingRows) {
      const probabilities = softmax(classes.map((_, classId) => biases[classId] + dot(weights[classId], row.x)));
      totalWeight += row.sampleWeight;
      for (let classId = 0; classId < classes.length; classId += 1) {
        const expected = classId === row.y ? 1 : 0;
        const error = (probabilities[classId] - expected) * row.sampleWeight;
        gradBiases[classId] += error;
        for (let featureId = 0; featureId < dimension; featureId += 1) {
          gradWeights[classId][featureId] += error * row.x[featureId];
        }
      }
    }

    const divisor = Math.max(1, totalWeight);
    for (let classId = 0; classId < classes.length; classId += 1) {
      biases[classId] -= learningRate * (gradBiases[classId] / divisor);
      for (let featureId = 0; featureId < dimension; featureId += 1) {
        const penalty = regularization * weights[classId][featureId];
        weights[classId][featureId] -= learningRate * (gradWeights[classId][featureId] / divisor + penalty);
      }
    }
  }

  return {
    classes,
    weights: Object.fromEntries(classes.map((label, index) => [label, weights[index].map(round6)])),
    biases: Object.fromEntries(classes.map((label, index) => [label, round6(biases[index])])),
  };
}

function trainRidgeRegression(rows, targetKey, featureStats, lambda) {
  if (!rows.length) {
    return { weights: FEATURE_NAMES.map(() => 0), bias: 0 };
  }

  const dimension = FEATURE_NAMES.length + 1;
  const matrix = Array.from({ length: dimension }, () => Array(dimension).fill(0));
  const vector = Array(dimension).fill(0);

  for (const row of rows) {
    const x = [1, ...standardizeRow(row, featureStats)];
    const y = Number(row[targetKey]);
    if (!Number.isFinite(y)) continue;
    for (let i = 0; i < dimension; i += 1) {
      vector[i] += x[i] * y;
      for (let j = 0; j < dimension; j += 1) {
        matrix[i][j] += x[i] * x[j];
      }
    }
  }

  for (let i = 1; i < dimension; i += 1) {
    matrix[i][i] += lambda;
  }

  const coefficients = solveLinearSystem(matrix, vector);
  return {
    bias: coefficients[0] || 0,
    weights: coefficients.slice(1),
  };
}

function evaluateFault(model, rows, featureStats) {
  if (!rows.length || !model.classes.length) return { validationRows: rows.length, validationAccuracy: null };
  let correct = 0;
  const confusion = {};
  for (const row of rows) {
    const predicted = predictSoftmax(model, standardizeRow(row, featureStats)).label;
    if (!confusion[row.label]) confusion[row.label] = {};
    confusion[row.label][predicted] = (confusion[row.label][predicted] || 0) + 1;
    if (predicted === row.label) correct += 1;
  }
  return {
    validationRows: rows.length,
    validationAccuracy: round4(correct / rows.length),
    confusion,
    classCounts: countBy(rows, "label"),
  };
}

function evaluateRegression(model, rows, targetKey, featureStats) {
  const trainLike = rows.filter((row) => Number.isFinite(Number(row[targetKey])));
  if (!trainLike.length) return { validationRows: rows.length, validationMaeW: null, validationRmseW: null };
  const errors = trainLike.map((row) => predictLinear(model, standardizeRow(row, featureStats)) - Number(row[targetKey]));
  return {
    validationRows: trainLike.length,
    validationMaeW: round2(average(errors.map(Math.abs)) ?? 0),
    validationRmseW: round2(Math.sqrt(average(errors.map((value) => value * value)) ?? 0)),
  };
}

function evaluateYaw(sinModel, cosModel, rows, featureStats) {
  const valid = rows.filter((row) => Number.isFinite(Number(row.targetYawDeg)));
  if (!valid.length) return { validationRows: rows.length, validationAngularMaeDeg: null };
  const errors = valid.map((row) => {
    const vector = standardizeRow(row, featureStats);
    const sin = predictLinear(sinModel, vector);
    const cos = predictLinear(cosModel, vector);
    const predicted = normalizeDegrees((Math.atan2(sin, cos) * 180) / Math.PI);
    return angularDistance(predicted, Number(row.targetYawDeg));
  });
  return {
    validationRows: valid.length,
    validationAngularMaeDeg: round2(average(errors) ?? 0),
  };
}

function fitFeatureStats(rows) {
  const means = {};
  const stds = {};
  for (const name of FEATURE_NAMES) {
    const values = rows.map((row) => Number(row[name])).filter(Number.isFinite);
    const mean = average(values) ?? 0;
    means[name] = mean;
    stds[name] = Math.max(stdDev(values), 0.000001);
  }
  return { means, stds };
}

function standardizeRow(row, featureStats) {
  return FEATURE_NAMES.map((name) => {
    const value = Number(row[name]);
    return ((Number.isFinite(value) ? value : 0) - featureStats.means[name]) / featureStats.stds[name];
  });
}

function predictSoftmax(model, vector) {
  const probabilities = softmax(
    model.classes.map((className) => (model.biases[className] || 0) + dot(model.weights[className] || [], vector)),
  );
  return model.classes
    .map((label, index) => ({ label, probability: probabilities[index] }))
    .sort((left, right) => right.probability - left.probability)[0];
}

function predictLinear(model, vector) {
  return model.bias + model.weights.reduce((sum, weight, index) => sum + weight * vector[index], 0);
}

function softmax(scores) {
  const maxScore = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - maxScore));
  const total = exps.reduce((sum, value) => sum + value, 0) || 1;
  return exps.map((value) => value / total);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * (right[index] || 0), 0);
}

function splitRows(rows, trainRatio) {
  const shuffled = deterministicShuffle(rows);
  const trainCount = Math.max(1, Math.floor(shuffled.length * trainRatio));
  return {
    train: shuffled.slice(0, trainCount),
    validation: shuffled.slice(trainCount),
  };
}

function deterministicShuffle(rows) {
  const copy = [...rows];
  let seed = 9301;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    seed = (seed * 49297 + 233280) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function weakFaultLabel(pointsWindow, activeThresholds) {
  const maxTemp = max(numbers(pointsWindow, (point) => point.genTempC)) ?? 0;
  const maxVibration = max(numbers(pointsWindow, (point) => point.vibrationRms)) ?? 0;
  const maxRotorRpm = max(numbers(pointsWindow, (point) => point.rotorRpm)) ?? 0;
  const minBattery = min(numbers(pointsWindow, (point) => point.batteryPct)) ?? 100;
  const maxLoad = max(numbers(pointsWindow, (point) => point.loadPowerW)) ?? 0;
  const maxAcCurrent = max(numbers(pointsWindow, (point) => point.outputCurrentAcA)) ?? 0;
  const maxBatteryCurrent = max(numbers(pointsWindow, (point) => Math.abs(point.genCurrentA ?? 0))) ?? 0;
  const minAcVoltage = min(numbers(pointsWindow, (point) => point.outputVoltageAcV)) ?? 230;
  const flags = pointsWindow.some((point) =>
    Boolean(
      point.batteryAlertOverload ||
        point.batteryAlertOvertemp ||
        point.inverterAlertOverload ||
        point.inverterAlertFault ||
        point.inverterAlertSupplyCut,
    ),
  );

  if (
    flags ||
    maxLoad >= activeThresholds.housePowerHighW ||
    maxAcCurrent >= activeThresholds.acCurrentHighA ||
    maxBatteryCurrent >= activeThresholds.batteryCurrentHighA ||
    minAcVoltage < activeThresholds.acVoltageLowV
  ) {
    return { label: "overload", severity: flags || minAcVoltage < activeThresholds.acVoltageLowV ? "critical" : "warning" };
  }
  if (maxVibration >= activeThresholds.vibrationHighRms || maxRotorRpm >= activeThresholds.rotorRpmHigh) {
    return { label: "high_vibration", severity: maxVibration >= activeThresholds.vibrationHighRms * 1.15 ? "critical" : "warning" };
  }
  if (maxTemp >= activeThresholds.tempHighC * 0.9) {
    return { label: "high_temp", severity: maxTemp >= activeThresholds.tempHighC ? "critical" : "warning" };
  }
  if (minBattery <= activeThresholds.batteryLowPct) {
    return { label: "low_battery", severity: minBattery <= activeThresholds.batteryCriticalPct ? "critical" : "warning" };
  }
  return { label: "nominal_operation", severity: "info" };
}

function nearestFuture(rows, index, horizonMs) {
  const currentTime = new Date(rows[index].timestamp).getTime();
  const target = currentTime + horizonMs;
  let best = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let i = index + 1; i < rows.length; i += 1) {
    const ts = new Date(rows[i].timestamp).getTime();
    const delta = Math.abs(ts - target);
    if (delta < bestDelta) {
      best = rows[i];
      bestDelta = delta;
    }
    if (ts > target + horizonMs) break;
  }
  return bestDelta <= horizonMs ? best : null;
}

function normalizeFeatureObject(raw) {
  return Object.fromEntries(
    FEATURE_NAMES.map((name) => {
      const value = Number(raw[name]);
      return [name, Number.isFinite(value) ? value : 0];
    }),
  );
}

function effectivePowerW(point) {
  if (!point) return null;
  if (point.loadPowerW !== null && point.loadPowerW !== undefined && point.loadPowerW >= 0) return point.loadPowerW;
  if (point.outputVoltageAcV !== null && point.outputCurrentAcA !== null) {
    return Math.max(0, point.outputVoltageAcV * point.outputCurrentAcA);
  }
  if (point.powerW !== null && point.powerW !== undefined) return Math.abs(point.powerW);
  return null;
}

function slopePerMinute(points, selector, limit = points.length) {
  const samples = points
    .slice(0, limit)
    .map((point) => ({ timestamp: point.timestamp, value: selector(point) }))
    .filter((sample) => {
      if (!sample.timestamp || sample.value === null || !Number.isFinite(sample.value)) return false;
      return !Number.isNaN(new Date(sample.timestamp).getTime());
    });
  if (samples.length < 2) return 0;
  const newest = samples[0];
  const oldest = samples[samples.length - 1];
  const minutes = (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return (newest.value - oldest.value) / minutes;
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    }
    if (Math.abs(augmented[pivot][col]) < 1e-10) {
      augmented[pivot][col] = 1e-10;
    }
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
    const divisor = augmented[col][col];
    for (let j = col; j <= n; j += 1) augmented[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= n; j += 1) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  return augmented.map((row) => row[n]);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

async function writeCsv(file, rows, columns) {
  const body = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
  ].join("\n");
  await fs.writeFile(file, `${body}\n`, "utf8");
}

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function envNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return false;
}

function normalizeTimestamp(value) {
  if (value instanceof Date) return value.toISOString();
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeDegrees(value) {
  if (value === null || value === undefined) return null;
  return ((Number(value) % 360) + 360) % 360;
}

function numbers(rows, selector) {
  return rows.map(selector).filter((value) => value !== null && Number.isFinite(value));
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = average(values) ?? 0;
  return Math.sqrt(average(values.map((value) => Math.pow(value - mean, 2))) ?? 0);
}

function min(values) {
  return values.length ? Math.min(...values) : null;
}

function max(values) {
  return values.length ? Math.max(...values) : null;
}

function circularMeanDeg(values) {
  if (!values.length) return null;
  const sums = values.reduce(
    (acc, value) => {
      const radians = (value * Math.PI) / 180;
      return { sin: acc.sin + Math.sin(radians), cos: acc.cos + Math.cos(radians) };
    },
    { sin: 0, cos: 0 },
  );
  if (Math.abs(sums.sin) < 0.000001 && Math.abs(sums.cos) < 0.000001) return null;
  return normalizeDegrees((Math.atan2(sums.sin, sums.cos) * 180) / Math.PI);
}

function circularSpreadDeg(values, meanDeg) {
  if (!values.length) return 180;
  return average(values.map((value) => angularDistance(value, meanDeg))) ?? 180;
}

function angularDistance(left, right) {
  const diff = Math.abs(normalizeDegrees(left) - normalizeDegrees(right)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function euclidean(left, right) {
  return Math.sqrt(left.reduce((sum, value, index) => sum + Math.pow(value - right[index], 2), 0));
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function round2(value) {
  return Number(Number(value).toFixed(2));
}

function round4(value) {
  return Number(Number(value).toFixed(4));
}

function round6(value) {
  return Number(Number(value).toFixed(6));
}

function formatMetric(value) {
  return value === null || value === undefined ? "n/a" : String(value);
}
