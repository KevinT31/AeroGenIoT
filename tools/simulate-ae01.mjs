#!/usr/bin/env node

const API_BASE = normalizeBase(process.env.API_BASE || "http://localhost:3000");
const INGEST_API_KEY = process.env.INGEST_API_KEY || "dev-ingest-key";

if (!process.env.API_BASE || !process.env.INGEST_API_KEY) {
  console.warn(
    "[simulate-ae01] API_BASE/INGEST_API_KEY no definidos. Usando defaults locales: " +
      `API_BASE=${API_BASE}, INGEST_API_KEY=${INGEST_API_KEY}`,
  );
}

const options = parseArgs(process.argv.slice(2));
const state = {
  windSpeedMs: options.wind,
  windDirectionDeg: options.direction,
  genVoltageV: options.volt,
  genCurrentA: options.current,
  outputVoltageAcV: options.outputVolt,
  outputCurrentAcA: options.outputCurrent,
  vibrationRms: options.vibration,
  genTempC: options.temp,
  rotorRpm: options.rpm,
  batteryPct: options.battery,
  loadPowerW: options.load,
};

const run = async () => {
  if (options.once) {
    const payload = buildPayload(options, state);
    await postIngest(payload);
    printSample(payload, true);
    return;
  }

  const tick = async () => {
    if (options.mode === "auto") {
      evolveAuto(state, options.jitter);
    }

    const payload = buildPayload(options, state);
    try {
      await postIngest(payload);
      printSample(payload, false);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ERROR ${error.message}`);
    }
  };

  await tick();
  setInterval(tick, options.intervalMs);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

function normalizeBase(value) {
  return String(value).trim().replace(/\/+$/, "");
}

function parseArgs(argv) {
  const opts = {
    mode: "auto",
    intervalMs: 5000,
    deviceId: "AE-01",
    farmId: "FARM-01",
    plotId: "PLOT-01",
    wind: 8.2,
    direction: 140,
    volt: 48.6,
    current: 12.1,
    outputVolt: 220,
    outputCurrent: 1.4,
    vibration: 2.4,
    temp: 54.0,
    rpm: 420,
    battery: 75,
    load: Number(process.env.DEFAULT_LOAD_W || 300),
    jitter: 0.8,
    once: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    if (token === "--once") {
      opts.once = true;
      continue;
    }

    const [rawKey, rawInline] = token.replace(/^--/, "").split("=");
    const next = rawInline !== undefined ? rawInline : argv[i + 1];
    const consumeNext = rawInline === undefined;

    switch (rawKey) {
      case "mode":
        opts.mode = next === "manual" ? "manual" : "auto";
        break;
      case "interval":
      case "intervalMs":
        opts.intervalMs = toNumber(next, opts.intervalMs);
        break;
      case "device":
      case "deviceId":
        opts.deviceId = String(next || opts.deviceId);
        break;
      case "farm":
      case "farmId":
        opts.farmId = String(next || opts.farmId);
        break;
      case "plot":
      case "plotId":
        opts.plotId = String(next || opts.plotId);
        break;
      case "wind":
        opts.wind = toNumber(next, opts.wind);
        break;
      case "direction":
      case "windDirection":
      case "windDir":
        opts.direction = toNumber(next, opts.direction);
        break;
      case "volt":
      case "voltage":
        opts.volt = toNumber(next, opts.volt);
        break;
      case "current":
      case "amp":
        opts.current = toNumber(next, opts.current);
        break;
      case "outputVolt":
      case "outputVoltage":
      case "acVoltage":
        opts.outputVolt = toNumber(next, opts.outputVolt);
        break;
      case "outputCurrent":
      case "acCurrent":
        opts.outputCurrent = toNumber(next, opts.outputCurrent);
        break;
      case "vibration":
        opts.vibration = toNumber(next, opts.vibration);
        break;
      case "temp":
      case "temperature":
        opts.temp = toNumber(next, opts.temp);
        break;
      case "rpm":
      case "rotorRpm":
        opts.rpm = toNumber(next, opts.rpm);
        break;
      case "battery":
        opts.battery = toNumber(next, opts.battery);
        break;
      case "load":
      case "loadPowerW":
        opts.load = toNumber(next, opts.load);
        break;
      case "jitter":
        opts.jitter = toNumber(next, opts.jitter);
        break;
      default:
        break;
    }

    if (consumeNext) i += 1;
  }

  return opts;
}

function buildPayload(options, state) {
  return {
    deviceId: options.deviceId,
    farmId: options.farmId,
    plotId: options.plotId,
    ts: new Date().toISOString(),
    windSpeedMs: round2(state.windSpeedMs),
    windDirectionDeg: round2(state.windDirectionDeg),
    genVoltageV: round2(state.genVoltageV),
    genCurrentA: round2(state.genCurrentA),
    outputVoltageAcV: round2(state.outputVoltageAcV),
    outputCurrentAcA: round2(state.outputCurrentAcA),
    vibrationRms: round2(state.vibrationRms),
    genTempC: round2(state.genTempC),
    rotorRpm: round2(state.rotorRpm),
    batteryPct: Math.round(clamp(state.batteryPct, 0, 100)),
    loadPowerW: round2(state.loadPowerW),
    mode: options.mode,
  };
}

function evolveAuto(state, jitter) {
  state.windSpeedMs = clamp(withJitter(state.windSpeedMs, jitter), 0, 35);
  state.windDirectionDeg = normalizeDegrees(withJitter(state.windDirectionDeg, jitter * 8));
  state.genVoltageV = clamp(withJitter(state.genVoltageV, jitter * 0.25), 0, 120);
  state.genCurrentA = clamp(withJitter(state.genCurrentA, jitter * 0.5), 0, 200);
  state.outputVoltageAcV = clamp(withJitter(state.outputVoltageAcV, jitter * 1.8), 0, 260);
  state.outputCurrentAcA = clamp(withJitter(state.outputCurrentAcA, jitter * 0.08), 0, 40);
  state.vibrationRms = clamp(withJitter(state.vibrationRms, jitter * 0.2), 0, 20);
  state.genTempC = clamp(withJitter(state.genTempC, jitter * 0.6), -20, 140);
  state.rotorRpm = clamp(withJitter(state.rotorRpm, jitter * 15), 0, 900);
  state.loadPowerW = clamp(withJitter(state.loadPowerW, jitter * 6), 10, 10000);

  const batteryDelta = state.windSpeedMs < 3 ? -0.7 : state.windSpeedMs > 10 ? 0.25 : -0.15;
  state.batteryPct = clamp(state.batteryPct + batteryDelta, 0, 100);
}

async function postIngest(payload) {
  const response = await fetch(`${API_BASE}/api/v1/readings/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": INGEST_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${text}`);
  }

  return response.json().catch(() => ({}));
}

function printSample(payload, once) {
  const powerW = round2(payload.genVoltageV * payload.genCurrentA);
  const suffix = once ? "single-shot" : payload.mode;
  console.log(
    `[${payload.ts}] ${suffix} device=${payload.deviceId} wind=${payload.windSpeedMs}m/s ` +
      `dir=${payload.windDirectionDeg}deg Vdc=${payload.genVoltageV} Idc=${payload.genCurrentA} P=${powerW}W ` +
      `Vac=${payload.outputVoltageAcV} Iac=${payload.outputCurrentAcA} rpm=${payload.rotorRpm} ` +
      `batt=${payload.batteryPct}% load=${payload.loadPowerW}W`,
  );
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function withJitter(value, jitter) {
  return value + (Math.random() * 2 - 1) * jitter;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function round2(value) {
  return Number(value.toFixed(2));
}
