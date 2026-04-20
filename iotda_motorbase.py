# iotda_motorbase.py
# Archivo canonico del simulador hibrido usado para Huawei IoTDA.
# Evitar mantener una segunda copia divergente del simulador.

import csv
import hashlib
import hmac
import json
import math
import random
import socket
import ssl
import struct
import time
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Dict, Iterable, Optional, Tuple

import paho.mqtt.client as mqtt

try:
    from rf24_py import RF24, PaLevel, DataRate

    RF24_PY_AVAILABLE = True
except ImportError:
    RF24 = None
    PaLevel = None
    DataRate = None
    RF24_PY_AVAILABLE = False


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

# Integracion opcional con Raspberry Pi + nRF24L01.
# Si la libreria o el hardware no estan presentes, el script sigue operando
# con simulacion pura sin alterar el payload MQTT.
RF_RECEIVER_ENABLED = True
RF_CE_PIN = 25
RF_CSN = 0
RF_CHANNEL = 76
RF_ADDRESS = b"00001"
RF_PAYLOAD_LENGTH = 32
RF_DATA_STALE_SECONDS = 4.0
RF_IDLE_SLEEP_SECONDS = 0.02
RF_ERROR_BACKOFF_SECONDS = 0.50
UDP_RECEIVER_ENABLED = True
UDP_BIND_IP = "0.0.0.0"
UDP_BIND_PORT = 5005
UDP_RECV_BUFFER_BYTES = 2048

# Supuestos operativos aceptados para combinar telemetria real con estimaciones.
REALTIME_USE_THERMOCOUPLE_AS_INVERTER_TEMP = True
AC_POWER_FACTOR_ESTIMATE = 0.96
AC_PRESENT_MIN_VOLTAGE = 40.0
AC_PRESENT_MIN_POWER_W = 15.0
EARTH_GRAVITY_MS2 = 9.80665


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
# PAQUETES RF ESP32 -> RASPBERRY
# =========================================
FMT_P1 = "<B6fB6x"
FMT_P2 = "<B3fBB17x"
PACKET1_SIZE = struct.calcsize(FMT_P1)
PACKET2_SIZE = struct.calcsize(FMT_P2)

if PACKET1_SIZE != RF_PAYLOAD_LENGTH or PACKET2_SIZE != RF_PAYLOAD_LENGTH:
    raise ValueError("Los paquetes RF no coinciden con 32 bytes.")


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


def is_fresh_timestamp(received_at_monotonic: float, max_age_seconds: float) -> bool:
    return received_at_monotonic > 0.0 and (time.monotonic() - received_at_monotonic) <= max_age_seconds


def derive_house_power_from_ac(voltage_ac_v: float, current_ac_a: float) -> float:
    apparent_power_w = max(voltage_ac_v, 0.0) * max(current_ac_a, 0.0)
    estimated_real_power_w = apparent_power_w * AC_POWER_FACTOR_ESTIMATE
    return clamp(estimated_real_power_w, 0.0, 4500.0)


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
# RECEPTOR RF EN RASPBERRY
# =========================================
@dataclass
class RealtimeSnapshot:
    packet1_received_at: float = 0.0
    packet2_received_at: float = 0.0
    packet1_source: str = "SIM"
    packet2_source: str = "SIM"
    inverter_temp_c: float = float("nan")
    accel_x_ms2: float = 0.0
    accel_y_ms2: float = 0.0
    accel_z_ms2: float = 0.0
    output_current_ac_a: float = 0.0
    output_voltage_ac_v: float = 0.0
    adxl_ok: bool = False
    blade_rpm: float = 0.0
    wind_speed_mps: float = 0.0
    wind_dir_deg: float = 0.0
    as5600_ok: bool = False
    pr3000_ok: bool = False
    last_packet_id: int = 0
    packets_received: int = 0


@dataclass
class RealtimeInputs:
    has_measured_output: bool = False
    measured_output_voltage_ac_v: float = 0.0
    measured_output_current_ac_a: float = 0.0
    measured_house_power_w: float = 0.0
    has_measured_temp: bool = False
    measured_inverter_temp_c: float = 0.0
    rotor_from_rf: bool = False
    output_from_rf: bool = False
    rotor_source: str = "SIM"
    output_source: str = "SIM"


class Rf24Receiver:
    def __init__(self) -> None:
        self.enabled = False
        self.rf_enabled = RF_RECEIVER_ENABLED and RF24_PY_AVAILABLE
        self.udp_enabled = UDP_RECEIVER_ENABLED
        self._lock = Lock()
        self._stop_event = Event()
        self._thread: Optional[Thread] = None
        self._radio = None
        self._udp_socket: Optional[socket.socket] = None
        self._snapshot = RealtimeSnapshot()
        self.startup_error: Optional[str] = None
        self._last_runtime_error: Optional[str] = None

    def start(self) -> None:
        started_transport = False

        if RF_RECEIVER_ENABLED and not RF24_PY_AVAILABLE:
            print("[WARN] rf24_py no esta disponible. RF queda deshabilitado.")

        if self.rf_enabled:
            try:
                self._configure_radio()
                started_transport = True
                print("[INFO] Receptor RF activo: Raspberry Pi escuchando por nRF24L01.")
            except Exception as exc:
                self.startup_error = str(exc)
                self.rf_enabled = False
                print(f"[WARN] No se pudo iniciar el receptor RF: {exc}")

        if self.udp_enabled:
            try:
                self._configure_udp()
                started_transport = True
                print(
                    f"[INFO] Receptor WiFi UDP activo: escuchando en "
                    f"{UDP_BIND_IP}:{UDP_BIND_PORT}."
                )
            except Exception as exc:
                self.udp_enabled = False
                print(f"[WARN] No se pudo iniciar el receptor UDP: {exc}")

        if not started_transport:
            self.enabled = False
            print("[INFO] No hay transporte real disponible. Se mantiene simulacion pura.")
            return

        self.enabled = True
        self._thread = Thread(target=self._run, name="rf24-listener", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=1.5)
        if self._radio is not None:
            try:
                self._radio.power_down()
            except Exception:
                pass
        if self._udp_socket is not None:
            try:
                self._udp_socket.close()
            except Exception:
                pass

    def get_snapshot(self) -> RealtimeSnapshot:
        with self._lock:
            return replace(self._snapshot)

    def _configure_radio(self) -> None:
        radio = RF24(RF_CE_PIN, RF_CSN)
        radio.begin()
        radio.power_up()
        radio.open_rx_pipe(1, RF_ADDRESS)
        radio.pa_level = PaLevel.Low
        radio.data_rate = DataRate.Kbps250
        radio.payload_length = RF_PAYLOAD_LENGTH
        radio.channel = RF_CHANNEL
        radio.as_rx()
        self._radio = radio

    def _configure_udp(self) -> None:
        udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        udp_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        udp_socket.bind((UDP_BIND_IP, UDP_BIND_PORT))
        udp_socket.setblocking(False)
        self._udp_socket = udp_socket

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                processed_packet = False

                if self._radio is not None:
                    self._radio.update()

                    while True:
                        has_data, pipe_index = self._radio.available_pipe()
                        if not has_data:
                            break

                        payload = bytes(self._radio.read(RF_PAYLOAD_LENGTH))
                        self._handle_payload(payload, source="RF", origin=f"pipe={pipe_index}")
                        processed_packet = True
                        self._radio.update()

                if self._udp_socket is not None:
                    while True:
                        try:
                            payload, addr = self._udp_socket.recvfrom(UDP_RECV_BUFFER_BYTES)
                        except BlockingIOError:
                            break

                        self._handle_payload(
                            bytes(payload),
                            source="WIFI",
                            origin=f"{addr[0]}:{addr[1]}",
                        )
                        processed_packet = True

                if not processed_packet:
                    time.sleep(RF_IDLE_SLEEP_SECONDS)

            except Exception as exc:
                message = str(exc)
                if message != self._last_runtime_error:
                    print(f"[WARN] Error en receptor RF: {exc}")
                    self._last_runtime_error = message
                time.sleep(RF_ERROR_BACKOFF_SECONDS)

    def _handle_payload(self, payload: bytes, source: str, origin: str = "") -> None:
        if len(payload) != RF_PAYLOAD_LENGTH:
            return

        packet_id = payload[0]
        now_monotonic = time.monotonic()

        try:
            if packet_id == 1:
                (
                    _,
                    temperatura,
                    ax,
                    ay,
                    az,
                    corriente,
                    voltaje,
                    adxl_ok_raw,
                ) = struct.unpack(FMT_P1, payload)

                with self._lock:
                    self._snapshot.packet1_received_at = now_monotonic
                    self._snapshot.packet1_source = source
                    self._snapshot.inverter_temp_c = float(temperatura)
                    self._snapshot.accel_x_ms2 = float(ax)
                    self._snapshot.accel_y_ms2 = float(ay)
                    self._snapshot.accel_z_ms2 = float(az)
                    self._snapshot.output_current_ac_a = max(float(corriente), 0.0)
                    self._snapshot.output_voltage_ac_v = max(float(voltaje), 0.0)
                    self._snapshot.adxl_ok = bool(adxl_ok_raw)
                    self._snapshot.last_packet_id = 1
                    self._snapshot.packets_received += 1
                return

            if packet_id == 2:
                (
                    _,
                    rpm,
                    velocidad_aire,
                    angulo,
                    as5600_ok_raw,
                    pr3000_ok_raw,
                ) = struct.unpack(FMT_P2, payload)

                with self._lock:
                    self._snapshot.packet2_received_at = now_monotonic
                    self._snapshot.packet2_source = source
                    self._snapshot.blade_rpm = max(float(rpm), 0.0)
                    self._snapshot.wind_speed_mps = max(float(velocidad_aire), 0.0)
                    self._snapshot.wind_dir_deg = wrap_angle_deg(float(angulo))
                    self._snapshot.as5600_ok = bool(as5600_ok_raw)
                    self._snapshot.pr3000_ok = bool(pr3000_ok_raw)
                    self._snapshot.last_packet_id = 2
                    self._snapshot.packets_received += 1
                return

        except struct.error:
            return


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


def estimate_motor_vibration_from_accelerometer(
    accel_x_ms2: float,
    accel_y_ms2: float,
    accel_z_ms2: float,
    blade_rpm: float,
) -> float:
    accel_magnitude_ms2 = math.sqrt(
        accel_x_ms2 * accel_x_ms2
        + accel_y_ms2 * accel_y_ms2
        + accel_z_ms2 * accel_z_ms2
    )
    dynamic_component_ms2 = abs(accel_magnitude_ms2 - EARTH_GRAVITY_MS2)
    rpm_component = clamp(blade_rpm / max(MAX_BLADE_RPM, 1.0), 0.0, 1.0)
    vibration_target = 0.55 + 0.72 * dynamic_component_ms2 + 1.25 * rpm_component
    return clamp(vibration_target, 0.35, 10.0)


def update_generation_from_observed_rotor(state: SimulatorState) -> None:
    rpm_excess_ratio = clamp(
        (state.blade_rpm - RATED_BLADE_RPM) / max(MAX_BLADE_RPM - RATED_BLADE_RPM, 1.0),
        0.0,
        1.25,
    )
    wind_stress_ratio = clamp((state.wind_speed_mps - 8.0) / 5.0, 0.0, 1.25)
    stress_target = clamp(
        0.10 + 0.42 * rpm_excess_ratio + 0.24 * wind_stress_ratio + 0.10 * state.gust_factor,
        0.05,
        1.0,
    )
    state.mechanical_stress = smooth_step(state.mechanical_stress, stress_target, 0.32)

    wind_ratio = clamp(
        (state.wind_speed_mps - WIND_CUT_IN_MPS) / max(WIND_RATED_MPS - WIND_CUT_IN_MPS, 0.1),
        0.0,
        1.18,
    )
    rpm_ratio = clamp(
        (state.blade_rpm - 60.0) / max(RATED_BLADE_RPM - 60.0, 1.0),
        0.0,
        1.18,
    )
    observed_ratio = clamp(0.55 * rpm_ratio + 0.45 * wind_ratio, 0.0, 1.18)

    if state.blade_rpm < 60.0 or state.wind_speed_mps < 0.6:
        generation_target_w = 0.0
    else:
        aerodynamic_efficiency = clamp(0.94 - 0.18 * state.mechanical_stress, 0.55, 0.96)
        generation_target_w = (
            MAX_WIND_GENERATION_W
            * math.pow(observed_ratio, 1.40)
            * aerodynamic_efficiency
        )

    state.internal_generation_w = smooth_step(
        state.internal_generation_w,
        clamp(generation_target_w, 0.0, MAX_WIND_GENERATION_W),
        0.38,
    )


def apply_realtime_snapshot_to_state(
    state: SimulatorState,
    snapshot: Optional[RealtimeSnapshot],
) -> RealtimeInputs:
    realtime = RealtimeInputs()
    if snapshot is None:
        return realtime

    packet2_fresh = is_fresh_timestamp(snapshot.packet2_received_at, RF_DATA_STALE_SECONDS)
    packet1_fresh = is_fresh_timestamp(snapshot.packet1_received_at, RF_DATA_STALE_SECONDS)

    if packet2_fresh:
        rotor_updated = False

        if math.isfinite(snapshot.blade_rpm):
            state.blade_rpm = clamp(snapshot.blade_rpm, 0.0, MAX_BLADE_RPM)
            rotor_updated = True

        if snapshot.pr3000_ok and math.isfinite(snapshot.wind_speed_mps):
            state.wind_speed_mps = clamp(snapshot.wind_speed_mps, 0.0, 16.0)
            state.wind_speed_target_mps = state.wind_speed_mps
            rotor_updated = True

        if snapshot.as5600_ok and math.isfinite(snapshot.wind_dir_deg):
            wrapped_dir_deg = wrap_angle_deg(snapshot.wind_dir_deg)
            state.wind_dir_deg = wrapped_dir_deg
            state.wind_dir_target_deg = wrapped_dir_deg
            rotor_updated = True

        if rotor_updated:
            update_generation_from_observed_rotor(state)
            realtime.rotor_from_rf = True
            realtime.rotor_source = snapshot.packet2_source

    if packet1_fresh:
        measured_voltage_ac_v = 0.0
        measured_current_ac_a = 0.0

        if math.isfinite(snapshot.output_voltage_ac_v):
            measured_voltage_ac_v = clamp(snapshot.output_voltage_ac_v, 0.0, 280.0)
        if math.isfinite(snapshot.output_current_ac_a):
            measured_current_ac_a = clamp(snapshot.output_current_ac_a, 0.0, 25.0)

        measured_house_power_w = derive_house_power_from_ac(
            measured_voltage_ac_v,
            measured_current_ac_a,
        )

        realtime.has_measured_output = True
        realtime.measured_output_voltage_ac_v = measured_voltage_ac_v
        realtime.measured_output_current_ac_a = measured_current_ac_a
        realtime.measured_house_power_w = measured_house_power_w
        realtime.output_from_rf = True
        realtime.output_source = snapshot.packet1_source

        state.house_demand_w = measured_house_power_w
        state.house_demand_target_w = measured_house_power_w

        if REALTIME_USE_THERMOCOUPLE_AS_INVERTER_TEMP and math.isfinite(snapshot.inverter_temp_c):
            realtime.has_measured_temp = True
            realtime.measured_inverter_temp_c = clamp(snapshot.inverter_temp_c, 0.0, 120.0)
            state.inverter_temp_c = realtime.measured_inverter_temp_c

        if snapshot.adxl_ok:
            realtime_vibration = estimate_motor_vibration_from_accelerometer(
                snapshot.accel_x_ms2,
                snapshot.accel_y_ms2,
                snapshot.accel_z_ms2,
                state.blade_rpm,
            )
            state.motor_vibration = smooth_step(state.motor_vibration, realtime_vibration, 0.72)

    return realtime


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
    realtime_inputs: Optional[RealtimeInputs] = None,
) -> bool:
    effective_supply_cut = supply_cut or inverter_fault_active

    if realtime_inputs is not None and realtime_inputs.has_measured_output:
        voltage_target_v = clamp(realtime_inputs.measured_output_voltage_ac_v, 0.0, 280.0)
        current_target_a = clamp(realtime_inputs.measured_output_current_ac_a, 0.0, 25.0)
        delivered_power_w = clamp(realtime_inputs.measured_house_power_w, 0.0, 4500.0)
        effective_supply_cut = voltage_target_v < AC_PRESENT_MIN_VOLTAGE

        if effective_supply_cut:
            voltage_target_v = 0.0
            current_target_a = 0.0
            delivered_power_w = 0.0

        state.inverter_output_voltage_ac_v = voltage_target_v
        state.inverter_output_current_ac_a = current_target_a
    elif supply_cut or inverter_fault_active:
        voltage_target_v = 0.0
        current_target_a = 0.0
        delivered_power_w = 0.0
        voltage_alpha = 0.62
        current_alpha = 0.72
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
    if realtime_inputs is not None and realtime_inputs.has_measured_temp:
        state.inverter_temp_c = clamp(realtime_inputs.measured_inverter_temp_c, 0.0, 120.0)
    else:
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

    return effective_supply_cut


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
def simulator_step(
    state: SimulatorState,
    rf_receiver: Optional[Rf24Receiver] = None,
) -> Dict[str, object]:
    dt_hours = PUBLISH_INTERVAL_SECONDS / 3600.0

    maybe_switch_mode(state)
    update_house_demand(state)

    state.ambient_temp_c = smooth_step(state.ambient_temp_c, state.ambient_temp_target_c, 0.08)
    update_wind_and_aerogenerator(state)

    realtime_snapshot = rf_receiver.get_snapshot() if rf_receiver is not None else None
    realtime_inputs = apply_realtime_snapshot_to_state(state, realtime_snapshot)

    inverter_fault_active = advance_inverter_fault_state(state)

    controller_result = calculate_battery_controller(
        state=state,
        dt_hours=dt_hours,
        inverter_fault_active=inverter_fault_active,
    )

    supply_cut = bool(controller_result["supply_cut"])
    delivered_house_power_w = float(controller_result["delivered_house_power_w"])

    effective_supply_cut = calculate_inverter_and_house_output(
        state=state,
        delivered_house_power_w=delivered_house_power_w,
        supply_cut=supply_cut,
        inverter_fault_active=inverter_fault_active,
        dt_hours=dt_hours,
        realtime_inputs=realtime_inputs,
    )

    update_alarm_state(
        state=state,
        inverter_fault_active=inverter_fault_active,
        supply_cut=effective_supply_cut,
    )

    event_time_utc = utc_now_iso()
    payload = build_mqtt_payload(state)
    row = build_csv_row(state, event_time_utc)
    realtime_sources = {
        "packet1": realtime_inputs.output_source if realtime_inputs.has_measured_output else "SIM",
        "packet2": realtime_inputs.rotor_source if realtime_inputs.rotor_from_rf else "SIM",
    }

    state.tick += 1

    return {
        "event_time_utc": event_time_utc,
        "payload": payload,
        "row": row,
        "realtime_sources": realtime_sources,
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
    rf_receiver = Rf24Receiver()
    rf_receiver.start()

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
                generated = simulator_step(state, rf_receiver=rf_receiver)
                payload = generated["payload"]
                row = generated["row"]
                realtime_sources = generated["realtime_sources"]
                payload_str = json.dumps(payload, ensure_ascii=False)

                result = client.publish(TOPIC_REPORT, payload_str, qos=QOS)

                if LOG_TO_CSV:
                    append_csv_row(CSV_PATH, row, CSV_FIELDNAMES)

                sent_count += 1

                print("-" * 110)
                print("[PUBLISH]")
                print("UTC:", generated["event_time_utc"])
                print("MODE:", row["mode"])
                print(
                    "INPUT SOURCES:",
                    f"P1={realtime_sources['packet1']}",
                    f"P2={realtime_sources['packet2']}",
                )
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
            rf_receiver.stop()
        except Exception:
            pass
        try:
            client.loop_stop()
            client.disconnect()
        except Exception:
            pass
        print("[INFO] Simulador detenido.")


if __name__ == "__main__":
    main()
