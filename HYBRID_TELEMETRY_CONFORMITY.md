# Conformidad Final de Telemetria Hibrida

Fecha de auditoria: 2026-04-15

## Criterio

Se reviso la coherencia entre:

- app movil
- dashboard
- backend
- simulador MQTT `iotda_motorbase.py`

La regla usada fue:

- `real`: variable o alarma pertenece al conjunto oficial
- `derivado valido`: se calcula a partir de variables oficiales
- `interno`: no se publica al payload MQTT y no es dependencia funcional obligatoria de la UI

## Variables oficiales

| Variable oficial | MQTT `iotda_motorbase.py` | Backend | App | Dashboard | Estado | Nota |
| --- | --- | --- | --- | --- | --- | --- |
| `battery_soc_pct` | si | si | si | si | conforme | base para reserva y bateria critica derivada |
| `battery_voltage_dc_v` | si | si | si | si | conforme | en UI interna se muestra como `genVoltageV` por compatibilidad |
| `battery_current_dc_a` | si | si | si | si | conforme | en UI interna se muestra como `genCurrentA` |
| `battery_power_w` | si | si | si | si | conforme | signo usado: positivo descarga, negativo carga |
| `battery_autonomy_estimated_h` | si | si | si | si | conforme | si falta, la app puede estimarla desde SOC y carga |
| `battery_alert_low` | si | si | si | si | conforme | el app tambien deriva `battery_critical` desde SOC |
| `battery_alert_overload` | si | si | si | si | conforme | el app lo agrupa como `system_overload` |
| `inverter_output_voltage_ac_v` | si | si | si | si | conforme | |
| `inverter_output_current_ac_a` | si | si | si | si | conforme | |
| `house_power_consumption_w` | si | si | si | si | conforme | en UI interna se muestra como `loadPowerW` |
| `energy_delivered_wh` | si | si | derivado | derivado | conforme | app y dashboard muestran `energyTodayKwh` derivado |
| `inverter_alert_overload` | si | si | si | si | conforme | el app lo agrupa como `system_overload` |
| `inverter_alert_fault` | si | si | si | si | conforme | |
| `inverter_alert_supply_cut` | si | si | si | si | conforme | |
| `inverter_temp_c` | si | si | si | si | conforme | en UI interna se muestra como `genTempC` |
| `motor_vibration` | si | si | si | si | conforme | en UI interna se muestra como `vibrationRms` |
| `wind_dir_deg` | si | si | si | si | conforme | en app se traduce a direccion legible |
| `wind_speed_mps` | si | si | si | si | conforme | |
| `blade_rpm` | si | si | si | si | conforme | en UI interna se muestra como `rotorRpm` |

## Variable tecnica opcional

| Variable | MQTT base | Backend | App | Dashboard | Estado | Nota |
| --- | --- | --- | --- | --- | --- | --- |
| `vibrationSignal` | no obligatoria | si | si, solo si existe | si, solo si existe | conforme | se mantiene solo como vista tecnica opcional |
| `battery_alert_overtemp` | opcional por bandera | si | si | si | conforme | no se publica por defecto en el simulador |

## Derivados validos visibles en UI

| Derivado | App | Dashboard | Base oficial |
| --- | --- | --- | --- |
| `battery_critical` | si | si como `soc_critical` | `battery_soc_pct` |
| `energyTodayKwh` | si | si | `energy_delivered_wh` |
| `system_overload` comunitario | si | no aplica | `battery_alert_overload` o `inverter_alert_overload` |
| `healthScore` / resiliencia | no | si | SOC, alarmas, AC, temperatura, vibracion, viento |
| narrativas y etiquetas de estado | si | si | variables oficiales y alarmas derivadas |

## Alarmas de app comunitaria

| Alarma app | Fuente | Estado |
| --- | --- | --- |
| `battery_low` | `battery_alert_low` o SOC < umbral | conforme |
| `battery_critical` | derivada desde `battery_soc_pct` | conforme |
| `battery_overtemperature` | `battery_alert_overtemp` opcional | conforme |
| `system_overload` | `battery_alert_overload` o `inverter_alert_overload` | conforme |
| `supply_cut` | `inverter_alert_supply_cut` | conforme |
| `inverter_fault` | `inverter_alert_fault` | conforme |
| `low_wind` | derivada desde `wind_speed_mps` | conforme |
| `high_wind` | derivada desde `wind_speed_mps` | conforme |
| `rotor_rpm_high` | derivada desde `blade_rpm` | conforme |
| `vibration_high` | derivada desde `motor_vibration` | conforme |
| `inverter_temp_high` | derivada desde `inverter_temp_c` | conforme |

## Alarmas operativas del dashboard

| Alarma dashboard | Fuente | Estado |
| --- | --- | --- |
| `soc_low` | derivada desde `battery_soc_pct` | conforme |
| `soc_critical` | derivada desde `battery_soc_pct` | conforme |
| `battery_voltage_low` | derivada desde `battery_voltage_dc_v` | conforme |
| `battery_voltage_high` | derivada desde `battery_voltage_dc_v` | conforme |
| `battery_discharge_current_high` | derivada desde `battery_current_dc_a` | conforme |
| `battery_charge_current_high` | derivada desde `battery_current_dc_a` | conforme |
| `battery_overtemperature` | `battery_alert_overtemp` o temperatura reportada | conforme |
| `controller_overload` | `battery_alert_overload` | conforme |
| `ac_voltage_low` | derivada desde `inverter_output_voltage_ac_v` | conforme |
| `ac_voltage_high` | derivada desde `inverter_output_voltage_ac_v` | conforme |
| `ac_current_high` | derivada desde `inverter_output_current_ac_a` | conforme |
| `house_power_high` | derivada desde `house_power_consumption_w` | conforme |
| `inverter_overload` | `inverter_alert_overload` | conforme |
| `inverter_fault` | `inverter_alert_fault` | conforme |
| `supply_cut` | `inverter_alert_supply_cut` | conforme |
| `inverter_temp_high` | derivada desde `inverter_temp_c` | conforme |
| `low_wind` | derivada desde `wind_speed_mps` | conforme |
| `high_wind` | derivada desde `wind_speed_mps` | conforme |
| `vibration_high` | derivada desde `motor_vibration` | conforme |
| `vibration_critical` | derivada desde `motor_vibration` | conforme |
| `rotor_rpm_out_of_range` | derivada desde `blade_rpm` | conforme |

## Restos internos aceptados

Estos campos no forman parte del payload real y no bloquean la conformidad:

- `sourceNow`
- `sourceReason`
- `mode`

Se mantienen como internos o de compatibilidad. No son requisito del product model ni de Huawei IoTDA.

## Resultado final

No se encontraron dependencias obligatorias de UI sobre variables MQTT viejas como:

- `voltage`
- `current`
- `power`
- `temp_thermocoupleK`
- `rpm_turbine`
- `status`

El simulador canonico publica el contrato correcto.
El backend ya acepta tanto el contrato plano como el push HTTP de IoTDA.
El app y el dashboard consumen las variables reales o derivados validos de esas variables.

## Decision de limpieza

La opcion mas limpia es la `1`:

- dejar `iotda_motorbase.py` como archivo canonico
- eliminar `iotda_test_hybrid.py`

Motivo:

- evita duplicidad y futuras divergencias
- `iotda_motorbase.py` ya contiene la simulacion mas completa
- ya esta alineado con el contrato real

## Estado aplicado

- `iotda_motorbase.py` queda como simulador canonico activo
- `iotda_test_hybrid.py` fue retirado del workspace
- el simulador canonico sigue compilando correctamente con `python -m py_compile "iotda_motorbase.py"`
