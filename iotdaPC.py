import importlib.util
from pathlib import Path


BASE_SCRIPT_PATH = Path(__file__).with_name("iotda_motorbase.py")


def load_base_module():
    spec = importlib.util.spec_from_file_location("iotda_base_pc", BASE_SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se pudo cargar el archivo base: {BASE_SCRIPT_PATH}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def configure_pc_profile(module) -> None:
    # Perfil de escritorio: dato real por WiFi UDP cuando exista,
    # con simulacion como respaldo. RF queda apagado en laptop.
    module.RF_RECEIVER_ENABLED = False
    module.UDP_RECEIVER_ENABLED = True
    module.CSV_PATH = "pc_hybrid_telemetry_log.csv"


def main() -> None:
    module = load_base_module()
    configure_pc_profile(module)

    print("[PROFILE] Ejecutando perfil PC")
    print("[PROFILE] RF deshabilitado")
    print("[PROFILE] WiFi UDP habilitado")
    print(f"[PROFILE] UDP bind: {module.UDP_BIND_IP}:{module.UDP_BIND_PORT}")
    print(f"[PROFILE] CSV local: {module.CSV_PATH}")

    module.main()


if __name__ == "__main__":
    main()
