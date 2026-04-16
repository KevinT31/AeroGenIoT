# iotda_test.py
# Archivo canonico del simulador hibrido usado para Huawei IoTDA.
# Evitar mantener una segunda copia divergente del simulador.

import csv
import hashlib
import hmac
import json
import math
import random
import ssl
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Event
from typing import Dict, Iterable, Tuple

import paho.mqtt.client as mqtt


# =========================================
# CONFIGURACION
# =========================================
DEVICE_ID = "69d70e84610343162ba9b34e_gateway-telemetry-001"
DEVICE_SECRET = "Catosimioauauau12345"
HOST = "43a4ff957e.st1.iotda-device.sa-brazil-1.myhuaweicloud.com"
PORT = 8883

SERVICE_ID = "Telemetry"
PUBLISH_INTERVAL_SECONDS = 10
QOS = 1

TOPIC_REPORT = f"$oc/devices/{DEVICE_ID}/sys/properties/report"

# Publicacion / registro local
LOG_TO_CSV = True
CSV_PATH = "simulated_hybrid_telemetry_log.csv"

# Cuantas publicaciones hacer.
# None = infinito hasta Ctrl+C
MAX_MESSAGES = 500

# Debe mantenerse en True para no publicar propiedades fuera del product model.
STRICT_BASE_PAYLOAD = True

# Semilla fija opcional para reproducibilidad
RANDOM_SEED = 42

# Variable opcional. Por defecto no se publica porque no siempre existe
# realmente en el controlador.
PUBLISH_BATTERY_ALERT_OVERTEMP = False


# =========================================
# LIMITES INTERNOS DEL SISTEMA
# =========================================
# Convencion de signo en bateria:
# - battery_power_w > 0  => la bateria se descarga
# - battery_power_w < 0  => la bateria se carga
# - battery_current_dc_a sigue la misma convencion
BATTERY_CAPACITY_WH = 4800.0
BATTERY_INITIAL_SOC_PCT = 58.0
BATTERY_MIN_SOC_PCT = 5.0
BATTERY_LOW_SOC_THRESHOLD_PCT = 20.0
BATTERY_MAX_CHARGE_W = 1500.0
BATTERY_MAX_DISCHARGE_W = 1800.0
BATTERY_OVERLOAD_POWER_W = 1600.0
BATTERY_OVERLOAD_CURRENT_A = 35.0

INVERTER_EFFICIENCY = 0.93
INVERTER_NOMINAL_VOLTAGE_AC = 230.0
INVERTER_RATED_POWER_W = 2200.0
INVERTER_OVERLOAD_POWER_W = 2300.0
INVERTER_OVERLOAD_CURRENT_A = 10.0
INVERTER_SUPPLY_MARGIN = 0.92

WIND_CUT_IN_MPS = 2.3
WIND_RATED_MPS = 11.0
MAX_BLADE_RPM = 760.0
RATED_BLADE_RPM = 650.0
MAX_WIND_GENERATION_W = 1700.0


# =========================================
# ESCENARIOS INTERNOS DE SIMULACION
# =========================================
MODE_RANGES = {
    "balanced": (28, 80),
    "low_wind": (24, 70),
    "strong_wind": (18, 52),
    "high_load": (18, 42),
    "night_low_load": (20, 56),
    "recovery": (14, 34),
}


# =========================================
# ORDEN FIJO DE TELEMETRIA PUBLICADA
# =========================================
PUBLISHED_PROPERTY_ORDER = [
    "battery_soc_pct",
    "battery_voltage_dc_v",
    "battery_current_dc_a",
    "battery_power_w",
    "battery_autonomy_estimated_h",
    "battery_alert_low",
    "battery_alert_overload",
    "inverter_output_voltage_ac_v",
    "inverter_output_current_ac_a",
    "house_power_consumption_w",
    "energy_delivered_wh",
    "inverter_alert_overload",
    "inverter_alert_fault",
    "inverter_alert_supply_cut",
    "inverter_temp_c",
    "motor_vibration",
    "wind_dir_deg",
    "wind_speed_mps",
    "blade_rpm",
]

if PUBLISH_BATTERY_ALERT_OVERTEMP:
    PUBLISHED_PROPERTY_ORDER.append("battery_alert_overtemp")

CSV_FIELDNAMES = [
    "event_time_utc",
    "device_id",
    "service_id",
    "mode",
    "tick",
    "wind_speed_mps",
    "wind_dir_deg",
    "blade_rpm",
    "internal_generation_w",
    "curtailed_wind_power_w",
    "house_demand_w",
    "battery_soc_pct",
    "battery_voltage_dc_v",
    "battery_current_dc_a",
    "battery_power_w",
    "battery_autonomy_estimated_h",
    "battery_alert_low",
    "battery_alert_overload",
    "battery_alert_overtemp",
    "inverter_output_voltage_ac_v",
    "inverter_output_current_ac_a",
    "house_power_consumption_w",
    "energy_delivered_wh",
    "inverter_alert_overload",
    "inverter_alert_fault",
    "inverter_alert_supply_cut",
    "inverter_temp_c",
    "motor_vibration",
    "battery_flow_mode",
    "ambient_temp_c",
    "battery_temp_c",
    "gust_factor",
    "mechanical_stress",
    "wind_low_counter",
    "battery_overload_counter",
    "inverter_overload_counter",
    "supply_cut_counter",
    "sustained_stress_counter",
]


# =========================================
# ESTADO GLOBAL
# =========================================
connected_event = Event()
stop_event = Event()


# =========================================
# UTILIDADES
# =========================================
def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def smooth_step(current: float, target: float, alpha: float) -> float:
    return current + alpha * (target - current)


def wrap_angle_deg(angle: float) -> float:
    return angle % 360.0


def angle_diff_deg(target: float, current: float) -> float:
    return (target - current + 180.0) % 360.0 - 180.0


def smooth_angle(current: float, target: float, alpha: float) -> float:
    return wrap_angle_deg(current + alpha * angle_diff_deg(target, current))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def adjust_counter(current: int, condition: bool, up: int = 1, down: int = 1) -> int:
    if condition:
        return current + up
    return max(0, current - down)


def round_or_zero(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def ensure_csv_header(csv_path: str, fieldnames: Iterable[str]) -> None:
    path = Path(csv_path)
    if path.exists():
        return

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(fieldnames))
        writer.writeheader()


def append_csv_row(csv_path: str, row: Dict[str, object], fieldnames: Iterable[str]) -> None:
    with Path(csv_path).open("a", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(fieldnames))
        writer.writerow(row)


# =========================================
# MQTT AUTH
# =========================================
def build_client_id_and_password(device_id: str, device_secret: str) -> Tuple[str, str, str]:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H")
    client_id = f"{device_id}_0_0_{timestamp}"
    username = device_id
    password = hmac.new(
        timestamp.encode("utf-8"),
        device_secret.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return client_id, username, password


# =========================================
# ESTADO INTERNO DEL SIMULADOR
# =========================================
@dataclass
class SimulatorState:
    tick: int
    mode: str
    mode_steps_remaining: int

    wind_speed_mps: float
    wind_speed_target_mps: float
    wind_dir_deg: float
    wind_dir_target_deg: float
    gust_factor: float
    gust_target_factor: float

    ambient_temp_c: float
    ambient_temp_target_c: float

    house_demand_w: float
    house_demand_target_w: float

    blade_rpm: float
    internal_generation_w: float
    curtailed_wind_power_w: float
    mechanical_stress: float
    stress_bias: float

    battery_energy_wh: float
    battery_soc_pct: float
    battery_voltage_dc_v: float
    battery_current_dc_a: float
    battery_power_w: float
    battery_autonomy_estimated_h: float
    battery_temp_c: float
    battery_flow_mode: str

    inverter_output_voltage_ac_v: float
    inverter_output_current_ac_a: float
    house_power_consumption_w: float
    energy_delivered_wh: float
    inverter_temp_c: float

    motor_vibration: float

    battery_alert_low: bool
    battery_alert_overload: bool
    battery_alert_overtemp: bool
    inverter_alert_overload: bool
    inverter_alert_fault: bool
    inverter_alert_supply_cut: bool

    wind_low_counter: int
    battery_overload_counter: int
    inverter_overload_counter: int
    supply_cut_counter: int
    sustained_stress_counter: int
    inverter_fault_steps_remaining: int


def choose_next_mode(previous_mode: str) -> str:
    weights = {
        "balanced": 0.34,
        "low_wind": 0.16,
        "strong_wind": 0.16,
        "high_load": 0.16,
        "night_low_load": 0.10,
        "recovery": 0.08,
    }

    if previous_mode in {"high_load", "strong_wind"}:
        weights["recovery"] += 0.08
    if previous_mode == "low_wind":
        weights["strong_wind"] += 0.05
    if previous_mode == "recovery":
        weights["balanced"] += 0.08
        weights["recovery"] = 0.02

    population = list(weights.keys())
    probabilities = list(weights.values())
    return random.choices(population, weights=probabilities, k=1)[0]


def choose_mode_duration(mode: str) -> int:
    min_steps, max_steps = MODE_RANGES[mode]
    return random.randint(min_steps, max_steps)


def assign_mode_targets(state: SimulatorState) -> None:
    if state.mode == "balanced":
        state.wind_speed_target_mps = random.uniform(4.8, 7.2)
        state.house_demand_target_w = random.uniform(420.0, 780.0)
        state.ambient_temp_target_c = random.uniform(17.0, 23.0)
        state.gust_target_factor = random.uniform(0.03, 0.14)
        state.stress_bias = -0.01
    elif state.mode == "low_wind":
        state.wind_speed_target_mps = random.uniform(1.0, 2.9)
        state.house_demand_target_w = random.uniform(480.0, 900.0)
        state.ambient_temp_target_c = random.uniform(16.0, 22.0)
        state.gust_target_factor = random.uniform(0.00, 0.08)
        state.stress_bias = -0.02
    elif state.mode == "strong_wind":
        state.wind_speed_target_mps = random.uniform(8.0, 12.5)
        state.house_demand_target_w = random.uniform(360.0, 760.0)
        state.ambient_temp_target_c = random.uniform(18.0, 24.0)
        state.gust_target_factor = random.uniform(0.12, 0.40)
        state.stress_bias = 0.05
    elif state.mode == "high_load":
        state.wind_speed_target_mps = random.uniform(3.5, 6.8)
        state.house_demand_target_w = random.uniform(1350.0, 2550.0)
        state.ambient_temp_target_c = random.uniform(19.0, 27.0)
        state.gust_target_factor = random.uniform(0.03, 0.14)
        state.stress_bias = 0.02
    elif state.mode == "night_low_load":
        state.wind_speed_target_mps = random.uniform(2.4, 5.8)
        state.house_demand_target_w = random.uniform(180.0, 420.0)
        state.ambient_temp_target_c = random.uniform(14.0, 20.0)
        state.gust_target_factor = random.uniform(0.01, 0.08)
        state.stress_bias = -0.02
    else:
        state.wind_speed_target_mps = random.uniform(4.0, 6.2)
        state.house_demand_target_w = random.uniform(320.0, 620.0)
        state.ambient_temp_target_c = random.uniform(16.0, 22.0)
        state.gust_target_factor = random.uniform(0.00, 0.06)
        state.stress_bias = -0.05

    state.wind_dir_target_deg = wrap_angle_deg(
        state.wind_dir_target_deg + random.uniform(-35.0, 35.0)
    )


def build_initial_state() -> SimulatorState:
    initial_soc = BATTERY_INITIAL_SOC_PCT
    initial_energy_wh = BATTERY_CAPACITY_WH * initial_soc / 100.0

    state = SimulatorState(
        tick=0,
        mode="balanced",
        mode_steps_remaining=choose_mode_duration("balanced"),
        wind_speed_mps=5.4,
        wind_speed_target_mps=5.8,
        wind_dir_deg=215.0,
        wind_dir_target_deg=215.0,
        gust_factor=0.05,
        gust_target_factor=0.08,
        ambient_temp_c=18.0,
        ambient_temp_target_c=19.5,
        house_demand_w=620.0,
        house_demand_target_w=650.0,
        blade_rpm=240.0,
        internal_generation_w=520.0,
        curtailed_wind_power_w=0.0,
        mechanical_stress=0.16,
        stress_bias=0.0,
        battery_energy_wh=initial_energy_wh,
        battery_soc_pct=initial_soc,
        battery_voltage_dc_v=50.4,
        battery_current_dc_a=2.5,
        battery_power_w=125.0,
        battery_autonomy_estimated_h=3.7,
        battery_temp_c=24.0,
        battery_flow_mode="discharging",
        inverter_output_voltage_ac_v=229.4,
        inverter_output_current_ac_a=2.7,
        house_power_consumption_w=620.0,
        energy_delivered_wh=0.0,
        inverter_temp_c=37.5,
        motor_vibration=2.4,
        battery_alert_low=False,
        battery_alert_overload=False,
        battery_alert_overtemp=False,
        inverter_alert_overload=False,
        inverter_alert_fault=False,
        inverter_alert_supply_cut=False,
        wind_low_counter=0,
        battery_overload_counter=0,
        inverter_overload_counter=0,
        supply_cut_counter=0,
        sustained_stress_counter=0,
        inverter_fault_steps_remaining=0,
    )
    assign_mode_targets(state)
    return state


def maybe_switch_mode(state: SimulatorState) -> None:
    state.mode_steps_remaining -= 1
    if state.mode_steps_remaining > 0:
        return

    state.mode = choose_next_mode(state.mode)
    state.mode_steps_remaining = choose_mode_duration(state.mode)
    assign_mode_targets(state)


# =========================================
# CALCULO AEROGENERADOR / VIENTO
# =========================================
def update_wind_and_aerogenerator(state: SimulatorState) -> None:
    state.gust_factor = smooth_step(state.gust_factor, state.gust_target_factor, 0.18)

    wind_noise = random.uniform(-0.18, 0.18) + random.uniform(-0.65, 0.65) * state.gust_factor
    next_wind = smooth_step(state.wind_speed_mps, state.wind_speed_target_mps, 0.16) + wind_noise
    state.wind_speed_mps = clamp(next_wind, 0.0, 16.0)

    dir_shift = random.uniform(-7.0, 7.0) + random.uniform(-14.0, 14.0) * state.gust_factor
    state.wind_dir_target_deg = wrap_angle_deg(state.wind_dir_target_deg + dir_shift)
    state.wind_dir_deg = smooth_angle(state.wind_dir_deg, state.wind_dir_target_deg, 0.24)

    stress_input = (
        0.035 * max(state.wind_speed_mps - 8.5, 0.0)
        + 0.12 * state.gust_factor
        + max(state.stress_bias, 0.0)
    )
    stress_relief = 0.03 + max(-state.stress_bias, 0.0)
    state.mechanical_stress = clamp(
        state.mechanical_stress + stress_input - stress_relief + random.uniform(-0.01, 0.01),
        0.05,
        1.0,
    )

    usable_wind_ratio = clamp(
        (state.wind_speed_mps - WIND_CUT_IN_MPS) / max(WIND_RATED_MPS - WIND_CUT_IN_MPS, 0.1),
        0.0,
        1.15,
    )

    if state.wind_speed_mps < WIND_CUT_IN_MPS:
        rpm_target = max(0.0, 25.0 * (state.wind_speed_mps / max(WIND_CUT_IN_MPS, 0.1)))
    else:
        rpm_target = (
            MAX_BLADE_RPM * math.pow(usable_wind_ratio, 1.10)
            + 70.0 * state.gust_factor
            - 42.0 * state.mechanical_stress
        )
    rpm_target = clamp(rpm_target, 0.0, MAX_BLADE_RPM)
    state.blade_rpm = smooth_step(state.blade_rpm, rpm_target, 0.20)
    state.blade_rpm = clamp(state.blade_rpm, 0.0, MAX_BLADE_RPM)

    if state.blade_rpm < 60.0:
        generation_target_w = 0.0
    else:
        rpm_ratio = clamp((state.blade_rpm - 60.0) / max(RATED_BLADE_RPM - 60.0, 1.0), 0.0, 1.18)
        aerodynamic_efficiency = clamp(0.92 - 0.20 * state.mechanical_stress, 0.55, 0.95)
        generation_target_w = MAX_WIND_GENERATION_W * math.pow(rpm_ratio, 1.45) * aerodynamic_efficiency

    state.internal_generation_w = smooth_step(state.internal_generation_w, generation_target_w, 0.24)
    state.internal_generation_w = clamp(state.internal_generation_w, 0.0, MAX_WIND_GENERATION_W)

    vibration_target = (
        0.75
        + 0.0062 * state.blade_rpm
        + 1.45 * state.mechanical_stress
        + 0.65 * state.gust_factor
        + random.uniform(-0.10, 0.10)
    )
    state.motor_vibration = smooth_step(state.motor_vibration, vibration_target, 0.22)
    state.motor_vibration = clamp(state.motor_vibration, 0.35, 10.0)


# =========================================
# CALCULO INVERSOR / CASA
# =========================================
def update_house_demand(state: SimulatorState) -> None:
    demand_wave = 55.0 * math.sin(state.tick / 14.0) + 30.0 * math.sin(state.tick / 5.0)
    demand_noise = random.uniform(-25.0, 25.0)
    target = state.house_demand_target_w + demand_wave + demand_noise
    target = clamp(target, 140.0, 2600.0)
    state.house_demand_w = smooth_step(state.house_demand_w, target, 0.18)
    state.house_demand_w = clamp(state.house_demand_w, 120.0, 2700.0)


def advance_inverter_fault_state(state: SimulatorState) -> bool:
    if state.inverter_fault_steps_remaining > 0:
        state.inverter_fault_steps_remaining -= 1
        return True

    should_trigger = (
        state.sustained_stress_counter >= 4 and random.random() < 0.18
    ) or (
        state.inverter_temp_c >= 82.0 and random.random() < 0.35
    )

    if should_trigger:
        duration = random.randint(3, 8)
        state.inverter_fault_steps_remaining = duration - 1
        return True

    return False


# =========================================
# CALCULO BATERIA / CONTROLADOR
# =========================================
def calculate_battery_controller(
    state: SimulatorState,
    dt_hours: float,
    inverter_fault_active: bool,
) -> Dict[str, float]:
    reserve_wh = BATTERY_CAPACITY_WH * BATTERY_MIN_SOC_PCT / 100.0
    usable_discharge_wh = max(state.battery_energy_wh - reserve_wh, 0.0)
    headroom_wh = max(BATTERY_CAPACITY_WH - state.battery_energy_wh, 0.0)

    discharge_limit_w = min(
        BATTERY_MAX_DISCHARGE_W,
        usable_discharge_wh / max(dt_hours, 1e-9),
    )
    charge_limit_w = min(
        BATTERY_MAX_CHARGE_W,
        headroom_wh / max(dt_hours, 1e-9),
    )

    battery_power_w = 0.0
    delivered_house_power_w = 0.0
    supply_cut = False
    curtailed_generation_w = 0.0

    if inverter_fault_active:
        supply_cut = True
        if state.internal_generation_w > 0.0 and charge_limit_w > 0.0:
            battery_power_w = -min(state.internal_generation_w, charge_limit_w)
            curtailed_generation_w = max(state.internal_generation_w - abs(battery_power_w), 0.0)
        else:
            battery_power_w = 0.0
            curtailed_generation_w = state.internal_generation_w
    else:
        dc_required_for_house_w = state.house_demand_w / max(INVERTER_EFFICIENCY, 0.1)

        if state.internal_generation_w >= dc_required_for_house_w:
            delivered_house_power_w = state.house_demand_w
            surplus_generation_w = state.internal_generation_w - dc_required_for_house_w
            battery_power_w = -min(surplus_generation_w, charge_limit_w)
            curtailed_generation_w = max(surplus_generation_w - abs(battery_power_w), 0.0)
        else:
            deficit_w = dc_required_for_house_w - state.internal_generation_w
            battery_power_w = min(deficit_w, discharge_limit_w)
            available_dc_to_house_w = state.internal_generation_w + battery_power_w
            available_ac_to_house_w = available_dc_to_house_w * INVERTER_EFFICIENCY

            if available_ac_to_house_w >= state.house_demand_w * INVERTER_SUPPLY_MARGIN:
                delivered_house_power_w = state.house_demand_w
            else:
                supply_cut = True
                delivered_house_power_w = 0.0
                if state.internal_generation_w > 0.0 and charge_limit_w > 0.0:
                    battery_power_w = -min(state.internal_generation_w, charge_limit_w)
                    curtailed_generation_w = max(state.internal_generation_w - abs(battery_power_w), 0.0)
                else:
                    battery_power_w = 0.0
                    curtailed_generation_w = state.internal_generation_w

    state.curtailed_wind_power_w = curtailed_generation_w
    state.battery_power_w = battery_power_w

    ocv_target_v = 44.2 + 8.6 * (state.battery_energy_wh / BATTERY_CAPACITY_WH)
    provisional_current_a = battery_power_w / max(ocv_target_v, 1.0)
    voltage_target_v = (
        ocv_target_v
        - 0.050 * max(provisional_current_a, 0.0)
        + 0.035 * max(-provisional_current_a, 0.0)
        + random.uniform(-0.08, 0.08)
    )
    voltage_target_v = clamp(voltage_target_v, 42.0, 58.0)
    state.battery_voltage_dc_v = smooth_step(state.battery_voltage_dc_v, voltage_target_v, 0.24)

    current_target_a = battery_power_w / max(state.battery_voltage_dc_v, 1.0)
    state.battery_current_dc_a = smooth_step(state.battery_current_dc_a, current_target_a, 0.28)

    state.battery_energy_wh = clamp(
        state.battery_energy_wh - battery_power_w * dt_hours,
        0.0,
        BATTERY_CAPACITY_WH,
    )
    state.battery_soc_pct = 100.0 * state.battery_energy_wh / BATTERY_CAPACITY_WH

    autonomy_reference_load_w = max(state.house_demand_w, 60.0)
    usable_autonomy_wh = max(state.battery_energy_wh - reserve_wh, 0.0)
    autonomy_h = usable_autonomy_wh / autonomy_reference_load_w
    state.battery_autonomy_estimated_h = clamp(autonomy_h, 0.0, 72.0)

    battery_temp_target_c = (
        state.ambient_temp_c
        + 4.0
        + 0.12 * abs(state.battery_current_dc_a)
        + 4.5 * (abs(state.battery_power_w) / max(BATTERY_MAX_DISCHARGE_W, 1.0))
        + random.uniform(-0.20, 0.20)
    )
    state.battery_temp_c = smooth_step(state.battery_temp_c, battery_temp_target_c, 0.16)
    state.battery_temp_c = clamp(state.battery_temp_c, 18.0, 65.0)

    if battery_power_w > 25.0:
        state.battery_flow_mode = "discharging"
    elif battery_power_w < -25.0:
        state.battery_flow_mode = "charging"
    else:
        state.battery_flow_mode = "idle"

    return {
        "delivered_house_power_w": delivered_house_power_w,
        "supply_cut": 1.0 if supply_cut else 0.0,
    }


def calculate_inverter_and_house_output(
    state: SimulatorState,
    delivered_house_power_w: float,
    supply_cut: bool,
    inverter_fault_active: bool,
    dt_hours: float,
) -> None:
    if supply_cut or inverter_fault_active:
        voltage_target_v = 0.0
        current_target_a = 0.0
        delivered_power_w = 0.0
        voltage_alpha = 0.62
        current_alpha = 0.72
    else:
        overload_penalty = max(state.house_demand_w - INVERTER_RATED_POWER_W, 0.0) / 600.0
        voltage_target_v = (
            INVERTER_NOMINAL_VOLTAGE_AC
            - 2.0 * overload_penalty
            + random.uniform(-1.2, 1.2)
        )
        voltage_target_v = clamp(voltage_target_v, 218.0, 233.0)
        current_target_a = delivered_house_power_w / max(voltage_target_v, 1.0)
        delivered_power_w = delivered_house_power_w
        voltage_alpha = 0.28
        current_alpha = 0.32

    state.inverter_output_voltage_ac_v = smooth_step(
        state.inverter_output_voltage_ac_v,
        voltage_target_v,
        voltage_alpha,
    )
    state.inverter_output_current_ac_a = smooth_step(
        state.inverter_output_current_ac_a,
        current_target_a,
        current_alpha,
    )
    state.house_power_consumption_w = delivered_power_w
    state.energy_delivered_wh += delivered_power_w * dt_hours

    load_ratio = delivered_power_w / max(INVERTER_RATED_POWER_W, 1.0)
    temp_target_c = (
        state.ambient_temp_c
        + 11.0
        + 34.0 * load_ratio
        + 5.5 * max((state.house_demand_w - INVERTER_RATED_POWER_W) / 600.0, 0.0)
        + 3.0 * state.mechanical_stress
        + (8.0 if inverter_fault_active else 0.0)
        + random.uniform(-0.30, 0.30)
    )
    state.inverter_temp_c = smooth_step(state.inverter_temp_c, temp_target_c, 0.18)
    state.inverter_temp_c = clamp(state.inverter_temp_c, 22.0, 92.0)


# =========================================
# ALARMAS
# =========================================
def update_alarm_state(
    state: SimulatorState,
    inverter_fault_active: bool,
    supply_cut: bool,
) -> None:
    state.wind_low_counter = adjust_counter(state.wind_low_counter, state.wind_speed_mps < 3.0)

    battery_overload_condition = (
        abs(state.battery_current_dc_a) >= BATTERY_OVERLOAD_CURRENT_A
        or abs(state.battery_power_w) >= BATTERY_OVERLOAD_POWER_W
    )
    state.battery_overload_counter = adjust_counter(
        state.battery_overload_counter,
        battery_overload_condition,
    )

    inverter_overload_condition = (
        state.house_demand_w >= INVERTER_OVERLOAD_POWER_W
        or state.inverter_output_current_ac_a >= INVERTER_OVERLOAD_CURRENT_A
    )
    state.inverter_overload_counter = adjust_counter(
        state.inverter_overload_counter,
        inverter_overload_condition,
    )

    state.supply_cut_counter = adjust_counter(state.supply_cut_counter, supply_cut or inverter_fault_active)

    stress_condition = (
        inverter_overload_condition
        or state.inverter_temp_c >= 74.0
        or (state.motor_vibration >= 7.0 and state.blade_rpm >= 650.0)
    )
    state.sustained_stress_counter = adjust_counter(state.sustained_stress_counter, stress_condition)

    state.battery_alert_low = state.battery_soc_pct < BATTERY_LOW_SOC_THRESHOLD_PCT
    state.battery_alert_overload = state.battery_overload_counter >= 2
    state.battery_alert_overtemp = state.battery_temp_c >= 48.0

    state.inverter_alert_overload = state.inverter_overload_counter >= 2
    state.inverter_alert_fault = inverter_fault_active
    state.inverter_alert_supply_cut = state.supply_cut_counter >= 1


# =========================================
# PAYLOAD MQTT
# =========================================
def build_product_model_properties(state: SimulatorState) -> Dict[str, object]:
    properties: Dict[str, object] = {
        "battery_soc_pct": round_or_zero(state.battery_soc_pct, 2),
        "battery_voltage_dc_v": round_or_zero(state.battery_voltage_dc_v, 2),
        "battery_current_dc_a": round_or_zero(state.battery_current_dc_a, 2),
        "battery_power_w": round_or_zero(state.battery_power_w, 2),
        "battery_autonomy_estimated_h": round_or_zero(state.battery_autonomy_estimated_h, 2),
        "battery_alert_low": state.battery_alert_low,
        "battery_alert_overload": state.battery_alert_overload,
        "inverter_output_voltage_ac_v": round_or_zero(state.inverter_output_voltage_ac_v, 2),
        "inverter_output_current_ac_a": round_or_zero(state.inverter_output_current_ac_a, 2),
        "house_power_consumption_w": round_or_zero(state.house_power_consumption_w, 2),
        "energy_delivered_wh": round_or_zero(state.energy_delivered_wh, 2),
        "inverter_alert_overload": state.inverter_alert_overload,
        "inverter_alert_fault": state.inverter_alert_fault,
        "inverter_alert_supply_cut": state.inverter_alert_supply_cut,
        "inverter_temp_c": round_or_zero(state.inverter_temp_c, 2),
        "motor_vibration": round_or_zero(state.motor_vibration, 3),
        "wind_dir_deg": int(round(state.wind_dir_deg)) % 360,
        "wind_speed_mps": round_or_zero(state.wind_speed_mps, 2),
        "blade_rpm": int(round(state.blade_rpm)),
    }

    if PUBLISH_BATTERY_ALERT_OVERTEMP:
        properties["battery_alert_overtemp"] = state.battery_alert_overtemp

    # Aunque STRICT_BASE_PAYLOAD cambie, no se agregan variables internas.
    # El product model solo recibe las variables reales definidas.
    ordered_properties = {
        key: properties[key]
        for key in PUBLISHED_PROPERTY_ORDER
        if key in properties
    }

    if STRICT_BASE_PAYLOAD:
        return ordered_properties
    return ordered_properties


def build_mqtt_payload(state: SimulatorState) -> Dict[str, object]:
    return {
        "services": [
            {
                "service_id": SERVICE_ID,
                "properties": build_product_model_properties(state),
            }
        ]
    }


# =========================================
# LOGGING CSV
# =========================================
def build_csv_row(state: SimulatorState, event_time_utc: str) -> Dict[str, object]:
    return {
        "event_time_utc": event_time_utc,
        "device_id": DEVICE_ID,
        "service_id": SERVICE_ID,
        "mode": state.mode,
        "tick": state.tick,
        "wind_speed_mps": round_or_zero(state.wind_speed_mps, 2),
        "wind_dir_deg": int(round(state.wind_dir_deg)) % 360,
        "blade_rpm": int(round(state.blade_rpm)),
        "internal_generation_w": round_or_zero(state.internal_generation_w, 2),
        "curtailed_wind_power_w": round_or_zero(state.curtailed_wind_power_w, 2),
        "house_demand_w": round_or_zero(state.house_demand_w, 2),
        "battery_soc_pct": round_or_zero(state.battery_soc_pct, 2),
        "battery_voltage_dc_v": round_or_zero(state.battery_voltage_dc_v, 2),
        "battery_current_dc_a": round_or_zero(state.battery_current_dc_a, 2),
        "battery_power_w": round_or_zero(state.battery_power_w, 2),
        "battery_autonomy_estimated_h": round_or_zero(state.battery_autonomy_estimated_h, 2),
        "battery_alert_low": state.battery_alert_low,
        "battery_alert_overload": state.battery_alert_overload,
        "battery_alert_overtemp": state.battery_alert_overtemp,
        "inverter_output_voltage_ac_v": round_or_zero(state.inverter_output_voltage_ac_v, 2),
        "inverter_output_current_ac_a": round_or_zero(state.inverter_output_current_ac_a, 2),
        "house_power_consumption_w": round_or_zero(state.house_power_consumption_w, 2),
        "energy_delivered_wh": round_or_zero(state.energy_delivered_wh, 2),
        "inverter_alert_overload": state.inverter_alert_overload,
        "inverter_alert_fault": state.inverter_alert_fault,
        "inverter_alert_supply_cut": state.inverter_alert_supply_cut,
        "inverter_temp_c": round_or_zero(state.inverter_temp_c, 2),
        "motor_vibration": round_or_zero(state.motor_vibration, 3),
        "battery_flow_mode": state.battery_flow_mode,
        "ambient_temp_c": round_or_zero(state.ambient_temp_c, 2),
        "battery_temp_c": round_or_zero(state.battery_temp_c, 2),
        "gust_factor": round_or_zero(state.gust_factor, 4),
        "mechanical_stress": round_or_zero(state.mechanical_stress, 4),
        "wind_low_counter": state.wind_low_counter,
        "battery_overload_counter": state.battery_overload_counter,
        "inverter_overload_counter": state.inverter_overload_counter,
        "supply_cut_counter": state.supply_cut_counter,
        "sustained_stress_counter": state.sustained_stress_counter,
    }


# =========================================
# PASO COMPLETO DEL SIMULADOR
# =========================================
def simulator_step(state: SimulatorState) -> Dict[str, object]:
    dt_hours = PUBLISH_INTERVAL_SECONDS / 3600.0

    maybe_switch_mode(state)
    update_house_demand(state)

    state.ambient_temp_c = smooth_step(state.ambient_temp_c, state.ambient_temp_target_c, 0.08)
    update_wind_and_aerogenerator(state)

    inverter_fault_active = advance_inverter_fault_state(state)

    controller_result = calculate_battery_controller(
        state=state,
        dt_hours=dt_hours,
        inverter_fault_active=inverter_fault_active,
    )

    supply_cut = bool(controller_result["supply_cut"])
    delivered_house_power_w = float(controller_result["delivered_house_power_w"])

    calculate_inverter_and_house_output(
        state=state,
        delivered_house_power_w=delivered_house_power_w,
        supply_cut=supply_cut,
        inverter_fault_active=inverter_fault_active,
        dt_hours=dt_hours,
    )

    update_alarm_state(
        state=state,
        inverter_fault_active=inverter_fault_active,
        supply_cut=supply_cut,
    )

    event_time_utc = utc_now_iso()
    payload = build_mqtt_payload(state)
    row = build_csv_row(state, event_time_utc)

    state.tick += 1

    return {
        "event_time_utc": event_time_utc,
        "payload": payload,
        "row": row,
    }


# =========================================
# MQTT CALLBACKS
# =========================================
def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"[CONNECT] reason_code={reason_code}")
    if reason_code == 0:
        connected_event.set()
        print("[OK] Conectado a IoTDA")
    else:
        connected_event.clear()
        print("[ERROR] No se pudo conectar a IoTDA")


def on_disconnect(client, userdata, disconnect_flags, reason_code, properties=None):
    connected_event.clear()
    print(f"[DISCONNECT] reason_code={reason_code}")


def on_publish(client, userdata, mid, reason_code=None, properties=None):
    print(f"[PUBLISH-ACK] mid={mid}")


def create_mqtt_client() -> mqtt.Client:
    client_id, username, password = build_client_id_and_password(DEVICE_ID, DEVICE_SECRET)

    print("=== MQTT PARAMS ===")
    print("HOST:", HOST)
    print("PORT:", PORT)
    print("CLIENT_ID:", client_id)
    print("USERNAME:", username)
    print("PASSWORD(HMAC):", password)
    print("===================")

    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=client_id,
        protocol=mqtt.MQTTv311,
    )
    client.username_pw_set(username=username, password=password)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_publish = on_publish

    client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
    client.tls_insecure_set(False)

    return client


# =========================================
# MAIN
# =========================================
def main():
    if RANDOM_SEED is not None:
        random.seed(RANDOM_SEED)

    client = create_mqtt_client()
    state = build_initial_state()

    if LOG_TO_CSV:
        ensure_csv_header(CSV_PATH, CSV_FIELDNAMES)
        print(f"[INFO] Logging local activado: {CSV_PATH}")

    print("[INFO] Convencion bateria:")
    print("       battery_power_w > 0  => descarga")
    print("       battery_power_w < 0  => carga")

    try:
        client.connect(HOST, PORT, keepalive=60)
        client.loop_start()

        print("[INFO] Esperando conexion...")
        if not connected_event.wait(timeout=15):
            print("[FATAL] No se logro conectar dentro del tiempo esperado.")
            return

        print(f"[INFO] Publicando cada {PUBLISH_INTERVAL_SECONDS} segundos. Ctrl+C para salir.")

        sent_count = 0

        while not stop_event.is_set():
            if connected_event.is_set():
                generated = simulator_step(state)
                payload = generated["payload"]
                row = generated["row"]
                payload_str = json.dumps(payload, ensure_ascii=False)

                result = client.publish(TOPIC_REPORT, payload_str, qos=QOS)

                if LOG_TO_CSV:
                    append_csv_row(CSV_PATH, row, CSV_FIELDNAMES)

                sent_count += 1

                print("-" * 110)
                print("[PUBLISH]")
                print("UTC:", generated["event_time_utc"])
                print("MODE:", row["mode"])
                print("WIND:", row["wind_speed_mps"], "m/s")
                print("DIR:", row["wind_dir_deg"], "deg")
                print("RPM:", row["blade_rpm"])
                print("GEN:", row["internal_generation_w"], "W")
                print("HOUSE DEMAND:", row["house_demand_w"], "W")
                print("HOUSE DELIVERED:", row["house_power_consumption_w"], "W")
                print("BAT SOC:", row["battery_soc_pct"], "%")
                print("BAT V:", row["battery_voltage_dc_v"], "V")
                print("BAT I:", row["battery_current_dc_a"], "A")
                print("BAT P:", row["battery_power_w"], "W")
                print("AUTONOMY:", row["battery_autonomy_estimated_h"], "h")
                print("INV V:", row["inverter_output_voltage_ac_v"], "V")
                print("INV I:", row["inverter_output_current_ac_a"], "A")
                print("INV TEMP:", row["inverter_temp_c"], "C")
                print("VIB:", row["motor_vibration"])
                print("ENERGY:", row["energy_delivered_wh"], "Wh")
                print(
                    "ALARMS:",
                    {
                        "battery_low": row["battery_alert_low"],
                        "battery_overload": row["battery_alert_overload"],
                        "inverter_overload": row["inverter_alert_overload"],
                        "inverter_fault": row["inverter_alert_fault"],
                        "supply_cut": row["inverter_alert_supply_cut"],
                    },
                )
                print("TOPIC:", TOPIC_REPORT)
                print("MID:", result.mid)
                print("RC:", result.rc)
                print("PAYLOAD:", payload_str)

                if MAX_MESSAGES is not None and sent_count >= MAX_MESSAGES:
                    print(f"[INFO] MAX_MESSAGES alcanzado: {MAX_MESSAGES}")
                    break
            else:
                print("[WARN] Cliente desconectado. Esperando reconexion...")

            time.sleep(PUBLISH_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print("\n[INFO] Interrupcion por usuario.")
    except Exception as exc:
        print(f"[ERROR] Excepcion no controlada: {exc}")
    finally:
        stop_event.set()
        try:
            client.loop_stop()
            client.disconnect()
        except Exception:
            pass
        print("[INFO] Simulador detenido.")


if __name__ == "__main__":
    main()
