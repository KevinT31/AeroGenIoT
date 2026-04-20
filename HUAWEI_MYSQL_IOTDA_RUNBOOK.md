# Aurora Noctua - Huawei MySQL + IoTDA Runbook

Fecha: 2026-04-15

## 1. Fuente correcta en la nube real

La nube ya validada no debe apuntar directo a `telemetry`.

La fuente correcta para backend, app y dashboard es:

```env
READINGS_SOURCE=telemetry_table
TELEMETRY_TABLE_NAME=app_telemetry_compat
```

Motivo:

- `telemetry` es la tabla cruda real
- el tiempo util real entra por `event_time_raw`
- la vista `app_telemetry_compat` ya corrige eso y expone `timestamp`
- la vista remapea nombres a formato app sin tocar la tabla cruda

## 2. Tabla cruda real en MySQL

La tabla real `telemetry` usa estas columnas:

- `id`
- `event_time`
- `device_id`
- `node_id`
- `wind_speed`
- `vibration`
- `temp_thermocoupleK`
- `voltage`
- `rpm_turbine`
- `current`
- `power`
- `wind_dir`
- `status`
- `raw_content`
- `event_time_raw`

## 3. Vista puente correcta

La vista que debe leer el backend es:

- `app_telemetry_compat`

Esta vista ya expone nombres compatibles con la app, al menos:

- `timestamp`
- `device_id`
- `wind_speed_mps`
- `wind_dir_deg`
- `battery_voltage_dc_v`
- `battery_current_dc_a`
- `battery_power_w`
- `motor_vibration`
- `vibration_signal`
- `blade_rpm`

Y deja en `NULL` por ahora lo que todavia no existe realmente en la telemetria actual:

- `battery_soc_pct`
- `battery_autonomy_estimated_h`
- `battery_alert_low`
- `battery_alert_overload`
- `battery_alert_overtemp`
- `inverter_output_voltage_ac_v`
- `inverter_output_current_ac_a`
- `house_power_consumption_w`
- `energy_delivered_wh`
- `inverter_alert_overload`
- `inverter_alert_fault`
- `inverter_alert_supply_cut`
- `inverter_temp_c`

## 4. Columnas esperadas por el backend

El backend ya puede leer directo desde MySQL si activas:

```env
READINGS_SOURCE=telemetry_table
TELEMETRY_TABLE_NAME=app_telemetry_compat
```

Los nombres que espera por defecto en la vista son:

| Variable real | Columna esperada |
| --- | --- |
| id tecnico | `id` |
| device id | `device_id` |
| farm id | `farm_id` |
| plot id | `plot_id` |
| fecha/hora de lectura | `timestamp` |
| velocidad del viento | `wind_speed_mps` |
| direccion del viento en grados | `wind_dir_deg` |
| voltaje DC bateria | `battery_voltage_dc_v` |
| corriente DC bateria | `battery_current_dc_a` |
| potencia de bateria | `battery_power_w` |
| estado de carga bateria | `battery_soc_pct` |
| autonomia estimada | `battery_autonomy_estimated_h` |
| alerta bateria baja | `battery_alert_low` |
| alerta sobrecarga bateria/controlador | `battery_alert_overload` |
| alerta sobretemperatura bateria | `battery_alert_overtemp` |
| voltaje AC salida | `inverter_output_voltage_ac_v` |
| corriente AC salida | `inverter_output_current_ac_a` |
| consumo de vivienda | `house_power_consumption_w` |
| energia acumulada entregada | `energy_delivered_wh` |
| alerta sobrecarga inversor | `inverter_alert_overload` |
| alerta falla inversor | `inverter_alert_fault` |
| alerta corte de suministro | `inverter_alert_supply_cut` |
| temperatura del inversor | `inverter_temp_c` |
| vibracion del motor | `motor_vibration` |
| senal cruda de vibracion opcional | `vibration_signal` |
| rpm de aletas | `blade_rpm` |

## 5. Columnas minimas para que la UI funcione bien

Con la vista actual, el sistema puede operar aunque falten varias variables, pero conviene al menos tener:

- `device_id`
- `timestamp`
- `wind_speed_mps`
- `wind_dir_deg`
- `battery_voltage_dc_v`
- `battery_current_dc_a`
- `battery_power_w`
- `motor_vibration`
- `blade_rpm`

Muy recomendadas para enriquecer la UI:

- `inverter_temp_c`
- `battery_soc_pct`
- `battery_autonomy_estimated_h`
- `inverter_output_voltage_ac_v`
- `inverter_output_current_ac_a`
- `house_power_consumption_w`
- `energy_delivered_wh`

## 6. Si la vista cambia y usa otros nombres

No hace falta tocar TypeScript otra vez.

Solo remapea en el backend con variables `TELEMETRY_COL_*`.

Ejemplo:

```env
TELEMETRY_COL_TIMESTAMP=event_time_fixed
TELEMETRY_COL_WIND_SPEED_MPS=wind_speed
TELEMETRY_COL_BLADE_RPM=rpm
```

## 7. .env del backend en Huawei

Base sugerida:

```env
DATABASE_URL=mysql://AURORA_APP_USER:TU_PASSWORD@TU_MYSQL_HOST:3306/aurora_iot
PRISMA_DB_SYNC_MODE=push
READINGS_SOURCE=telemetry_table
TELEMETRY_TABLE_NAME=app_telemetry_compat
TELEMETRY_DEFAULT_DEVICE_ID=69d70e84610343162ba9b34e_gateway-telemetry-001
TELEMETRY_DEFAULT_FARM_ID=demo-farm
TELEMETRY_DEFAULT_PLOT_ID=demo-plot
JWT_SECRET=CAMBIAR_POR_UN_TOKEN_LARGO
INGEST_API_KEY=CAMBIAR_POR_UN_TOKEN_LARGO
IOTDA_HTTP_PUSH_TOKEN=CAMBIAR_POR_UN_TOKEN_LARGO
```

Archivo preparado en el repo:

- `app/backend/.env.huawei.mysql.example`

## 8. .env del dashboard

Archivo preparado:

- `app/dashboard/.env.huawei.example`

Base:

```env
VITE_API_BASE=https://TU_BACKEND_PUBLICO
VITE_DEVICE_ID=69d70e84610343162ba9b34e_gateway-telemetry-001
VITE_FARM_ID=demo-farm
VITE_PLOT_ID=demo-plot
VITE_REALTIME_ENABLED=true
VITE_USE_MOCK=false
```

## 9. .env del movil

Archivo preparado:

- `app/mobile/.env.huawei.example`

Base:

```env
EXPO_PUBLIC_API_BASE=https://TU_BACKEND_PUBLICO
EXPO_PUBLIC_DEVICE_ID=69d70e84610343162ba9b34e_gateway-telemetry-001
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_REALTIME_ENABLED=true
EXPO_PUBLIC_CLOUD_PROFILE=huawei
```

## 10. Que revisar en Huawei para que la Raspberry vuelva a publicar como antes

Checklist:

1. Verifica que la instancia IoTDA y el `device_id` de la Raspberry sean los mismos que usaras en backend, dashboard y movil.
2. Verifica que el product model tenga `service_id = Telemetry`.
3. Verifica que las propiedades del product model se llamen exactamente como el nuevo `iotda_motorbase.py` publica.
4. Verifica que el dispositivo tenga `device secret` correcto y que la Raspberry use ese secreto.
5. Verifica que el endpoint MQTT/TLS de IoTDA corresponda a tu region e instancia.
6. Verifica que IoTDA siga insertando en la tabla cruda `telemetry`.
7. Verifica que la vista `app_telemetry_compat` exista y convierta `event_time_raw` a `timestamp`.
8. Si usas push HTTP al backend, confirma que la URL publica sea `POST /api/v1/readings/iotda/property-push`.
9. Verifica que el backend publico responda por HTTPS.
10. Verifica que dashboard y movil apunten al mismo dominio base del backend.

## 11. Propiedades que debe publicar `iotda_motorbase.py`

- `battery_soc_pct`
- `battery_voltage_dc_v`
- `battery_current_dc_a`
- `battery_power_w`
- `battery_autonomy_estimated_h`
- `battery_alert_low`
- `battery_alert_overload`
- `inverter_output_voltage_ac_v`
- `inverter_output_current_ac_a`
- `house_power_consumption_w`
- `energy_delivered_wh`
- `inverter_alert_overload`
- `inverter_alert_fault`
- `inverter_alert_supply_cut`
- `inverter_temp_c`
- `motor_vibration`
- `wind_dir_deg`
- `wind_speed_mps`
- `blade_rpm`

Opcional por bandera:

- `battery_alert_overtemp`

## 12. Tablas de IA

Estas tablas ya existen:

- `ai_fault_predictions`
- `ai_power_forecast`
- `ai_yaw_recommendations`

Si estan vacias y quieres llenarlas desde entrenamiento, activa:

```env
AURORA_WRITE_BACK=true
```

Con `AURORA_WRITE_BACK=false` pueden seguir vacias aunque el entrenamiento funcione.

## 13. Que necesita la otra IA de la nube

Para continuar sin adivinar nada, pasale esto:

- URL publica real del backend
- confirmacion de si el backend ya esta desplegado
- `device_id` real final que usaran
- confirmacion de que la vista correcta es `app_telemetry_compat`
- confirmacion de si la vista ya incluye `farm_id` y `plot_id` o si quedaran nulos
- confirmacion de si mantendran `READINGS_SOURCE=telemetry_table`
- confirmacion de si `AURORA_WRITE_BACK=true` se activara o no
- si IoTDA inserta directo a MySQL o si ademas quieren usar push HTTP al backend
- secretos ya cargados en Huawei para backend
- valor final que pondran en:
  - `VITE_API_BASE`
  - `EXPO_PUBLIC_API_BASE`

## 14. Que debe modificar la otra IA en nube

En backend:

- cargar el `.env` de backend con MySQL
- dejar `READINGS_SOURCE=telemetry_table`
- dejar `TELEMETRY_TABLE_NAME=app_telemetry_compat`
- poner `TELEMETRY_DEFAULT_DEVICE_ID` al `device_id` real
- desplegar backend con HTTPS publico

En dashboard:

- poner `VITE_API_BASE=https://TU_BACKEND_PUBLICO`
- poner `VITE_DEVICE_ID` al `device_id` real

En movil:

- poner `EXPO_PUBLIC_API_BASE=https://TU_BACKEND_PUBLICO`
- poner `EXPO_PUBLIC_DEVICE_ID` al `device_id` real

En nube:

- asegurar que la vista `app_telemetry_compat` siga vigente
- asegurar que `telemetry` siga creciendo con IoTDA
- decidir si activaran `AURORA_WRITE_BACK=true`

## 15. Archivos del repo ya preparados

- `app/backend/.env.huawei.mysql.example`
- `app/dashboard/.env.huawei.example`
- `app/mobile/.env.huawei.example`
- `app/backend/src/modules/readings/telemetry-table.service.ts`

## 16. Referencias oficiales Huawei

- Rules Overview:
  https://support.huaweicloud.com/intl/en-us/usermanual-iothub/iot_01_0022.html
- Device Reporting Properties:
  https://support.huaweicloud.com/intl/en-us/usermanual-iothub/iot_01_0326.html
- Push a Device Property Reporting Notification:
  https://support.huaweicloud.com/intl/en-us/api-iothub/iot_06_v5_01202.html
- Subscription and Push FAQ:
  https://support.huaweicloud.com/intl/en-us/iothub_faq/iot_faq_00101.html
