# 05 Model Implementation, Training, and Inference

## Scope

Aurora Noctua uses three operational AI functions in the implemented system:

- fault prediction
- power forecasting
- yaw recommendation

This document separates what is present in the repository from what is part of the real production workflow but not yet exported into source control.

## Implemented AI Functions

| Function | Operational purpose | Repository-side implementation |
| --- | --- | --- |
| Fault prediction | Identify the most likely failure pattern or abnormal operating mode | MySQL AI-table ingestion with local telemetry-based inference fallback, plus dashboard and mobile rendering |
| Power forecasting | Estimate near-term turbine power output | MySQL AI-table ingestion with local telemetry-based inference fallback, plus dashboard and mobile rendering |
| Yaw recommendation | Suggest target yaw orientation based on operational context | MySQL AI-table ingestion with local telemetry-based inference fallback, plus dashboard and mobile rendering |

## Repository Files That Implement the AI Integration

### Backend

- `app/backend/src/modules/ai/ai.controller.ts`
  - exposes `GET /api/v1/ai/operational`
- `app/backend/src/modules/ai/ai-operational.service.ts`
  - reads the latest row from the AI tables
  - loads a trained JSON model artifact when available
  - calculates local telemetry-based inference when AI table rows are missing
  - normalizes flexible column naming
  - returns one consolidated operational AI snapshot
- `app/backend/scripts/operational-ai/train-operational-ai.mjs`
  - exports operational datasets from MySQL and telemetry CSV files
  - trains replaceable JSON models for the three operational AI outputs
- `app/backend/models/operational-ai/operational-ai-models.json`
  - stores the current trained operational model artifact
- `app/backend/.env.example`
- `app/backend/.env.huawei.mysql.example`
  - define AI table names and default device identifiers

### Dashboard

- `app/dashboard/src/services/aiOperationalService.ts`
  - reads operational AI from the backend
  - can fall back to synthetic mock logic when mock mode is enabled
- `app/dashboard/src/components/maintenance/OperationalAiPanel.tsx`
  - renders fault, power, and yaw results
- `app/dashboard/src/services/maintenanceService.ts`
  - transforms AI outputs into predictive maintenance actions

### Mobile

- `app/mobile/src/services/aiService.ts`
  - reads operational AI from the backend
  - can fall back to synthetic mock logic when mock mode is enabled
- `app/mobile/src/screens/AiScreen.tsx`
  - renders operational AI outputs in the mobile application

## Operational AI Data Sources

The implemented backend can consume three MySQL AI output tables:

- `ai_fault_predictions`
- `ai_power_forecast`
- `ai_yaw_recommendations`

Configured through:

- `AI_FAULT_TABLE_NAME`
- `AI_POWER_TABLE_NAME`
- `AI_YAW_TABLE_NAME`
- `AI_DEFAULT_DEVICE_ID`

The backend is intentionally tolerant to column name variation and tries multiple candidate names for labels, timestamps, confidence values, and target variables.

If those AI tables are absent or a specific output is missing, the backend now derives the missing operational AI output from recent telemetry. It can read telemetry from the Prisma `SensorReading` table or from an external `telemetry` table when `READINGS_SOURCE=telemetry_table`.

Generated local datasets are written to:

- `artifacts/operational-ai/datasets/telemetry_points.csv`
- `artifacts/operational-ai/datasets/fault_dataset.csv`
- `artifacts/operational-ai/datasets/power_forecast_dataset.csv`
- `artifacts/operational-ai/datasets/yaw_recommendation_dataset.csv`

Training metrics are written to:

- `artifacts/operational-ai/logs/training-metrics.json`

A sample backend inference response is written to:

- `artifacts/operational-ai/logs/inference-sample.json`

## Inference Logic Present in the Repository

### Server-Side Inference

The repository-side inference path has two layers:

1. read the latest AI rows from MySQL when available
2. normalize fields into one stable schema
3. use the trained local JSON model when available
4. fill missing outputs with telemetry-based heuristic inference
5. expose the merged result through `/api/v1/ai/operational`
6. consume the result in dashboard and mobile

The local model artifact is a lightweight trained model package, not a neural-network checkpoint. It gives the product a self-contained operational AI layer while leaving the table-based contract ready for later ModelArts or heavier trained-model outputs.

Current local training uses:

- weak-supervised and synthetic-stress labels for fault prediction
- future telemetry targets for near-term power forecasting
- future wind-direction targets for yaw recommendation

The trained artifact contains:

- softmax classifier for `faultPrediction`
- ridge regression for `powerForecast`
- circular ridge regression for `yawRecommendation`

### Frontend Mock and Demo Fallback

Both frontends include synthetic fallback logic for demonstration mode:

- dashboard: `app/dashboard/src/services/aiOperationalService.ts`
- mobile: `app/mobile/src/services/aiService.ts`

These mock paths derive simple AI-like outputs from live telemetry when:

- the API is not configured
- mock mode is enabled
- operational AI data is unavailable

This fallback should be described as a demo support feature, not as the authoritative production model implementation.

## Training Code Status

### What Was Expected

The regional competition requires:

- training code
- inference code
- saved weights
- training logs
- inference logs

### What Is Actually Present

Present:

- inference-side backend integration
- local dataset generation script
- local training script
- trained JSON operational model artifact
- frontend rendering of operational AI outputs
- maintenance derivation from AI outputs

Missing from the repository:

- ModelArts training notebooks or scripts
- exported production/ModelArts training datasets
- neural-network or framework-specific model weights
- dedicated offline inference scripts

## Libraries Used in the Repository-Side AI Layer

Visible in the repository:

- NestJS
- Prisma
- MySQL
- React
- Expo
- TypeScript
- Node.js standard runtime for local operational AI training

Not used as implemented training libraries in the current local training path:

- MindSpore
- CANN
- PyTorch
- TensorFlow
- scikit-learn
- XGBoost

Because those libraries are not used in the current repository training path, they must not be claimed as implemented in the submission package.

## Where Outputs Are Stored

Operational AI outputs are expected in MySQL tables:

- `ai_fault_predictions`
- `ai_power_forecast`
- `ai_yaw_recommendations`

Application-facing normalization output is returned through:

- `GET /api/v1/ai/operational`

The local trained artifact is stored at:

- `app/backend/models/operational-ai/operational-ai-models.json`

Derived UI outputs appear in:

- dashboard AI panel
- dashboard predictive maintenance lane
- mobile AI screen

## How AI Is Integrated Into the Product

### Fault Prediction

- shown in dashboard and mobile
- influences predictive maintenance visit planning
- can contribute to operator attention and alert review

### Power Forecasting

- shown as near-term expected power
- compared with demand and reserve context
- can generate predictive maintenance or intervention planning

### Yaw Recommendation

- shown as target orientation
- compared with live direction
- can trigger a field validation maintenance item

## Honest Conclusion

Aurora Noctua currently includes the production-facing AI integration and consumption path, but not the complete training asset package required for a fully self-contained competition ZIP. Those missing pieces are tracked in:

- [06_DATASETS_AND_ARTIFACTS.md](06_DATASETS_AND_ARTIFACTS.md)
- [09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md](09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md)
