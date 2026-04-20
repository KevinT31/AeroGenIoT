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
| Fault prediction | Identify the most likely failure pattern or abnormal operating mode | MySQL table ingestion through the backend operational AI service, plus dashboard and mobile rendering |
| Power forecasting | Estimate near-term turbine power output | MySQL table ingestion through the backend operational AI service, plus dashboard and mobile rendering |
| Yaw recommendation | Suggest target yaw orientation based on operational context | MySQL table ingestion through the backend operational AI service, plus dashboard and mobile rendering |

## Repository Files That Implement the AI Integration

### Backend

- `app/backend/src/modules/ai/ai.controller.ts`
  - exposes `GET /api/v1/ai/operational`
- `app/backend/src/modules/ai/ai-operational.service.ts`
  - reads the latest row from the AI tables
  - normalizes flexible column naming
  - returns one consolidated operational AI snapshot
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

The implemented backend expects three MySQL tables:

- `ai_fault_predictions`
- `ai_power_forecast`
- `ai_yaw_recommendations`

Configured through:

- `AI_FAULT_TABLE_NAME`
- `AI_POWER_TABLE_NAME`
- `AI_YAW_TABLE_NAME`
- `AI_DEFAULT_DEVICE_ID`

The backend is intentionally tolerant to column name variation and tries multiple candidate names for labels, timestamps, confidence values, and target variables.

## Inference Logic Present in the Repository

### Server-Side Inference Integration

The repository-side inference path is not a local ML runtime loading serialized models. Instead, it is a production integration layer:

1. read the latest AI rows from MySQL
2. normalize fields into one stable schema
3. expose the merged result through `/api/v1/ai/operational`
4. consume the result in dashboard and mobile

This is real implemented inference consumption, even though the actual trained model execution is external to this repository.

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
- frontend rendering of operational AI outputs
- maintenance derivation from AI outputs

Missing from the repository:

- ModelArts training notebooks or scripts
- exported training datasets
- model serialization files
- training logs
- dedicated offline inference scripts

## Libraries Used in the Repository-Side AI Layer

Visible in the repository:

- NestJS
- Prisma
- MySQL
- React
- Expo
- TypeScript

Not found as implemented training libraries in the repository:

- MindSpore
- CANN
- PyTorch
- TensorFlow
- scikit-learn
- XGBoost

Because no evidence of those libraries was found in the repository, they must not be claimed as implemented in the submission package.

## Where Outputs Are Stored

Operational AI outputs are expected in MySQL tables:

- `ai_fault_predictions`
- `ai_power_forecast`
- `ai_yaw_recommendations`

Application-facing normalization output is returned through:

- `GET /api/v1/ai/operational`

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
