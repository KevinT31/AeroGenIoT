# 08 Submission Checklist

## Evaluator-Facing Checklist

| Submission item | Status | Notes |
| --- | --- | --- |
| Template 2 presentation slides included | Missing | Placeholder documented, but slide deck is not in the repository |
| Source code included | Present | Backend, dashboard, mobile, edge scripts, and tools are present |
| Model implementation included | Present | Operational AI integration, local model inference, and trained JSON artifact are present |
| Training code included | Partial | Local operational AI training script is present; ModelArts notebooks are still not exported |
| Inference code included | Present | Backend operational AI service includes table-based ingestion, trained JSON model inference, and heuristic fallback |
| Dataset samples included | Partial | Generated operational AI datasets are present; sanitized production DB exports are still missing |
| Model weights included | Present | Lightweight JSON operational model artifact is present |
| Training logs included | Present | `artifacts/operational-ai/logs/training-metrics.json` is present |
| Inference logs included | Present | `artifacts/operational-ai/logs/inference-sample.json` is present |
| Root README included | Present | Rewritten for competition evaluation |
| Open-source screenshot included | Missing | Placeholder path created in `docs/submission/assets/` |
| Architecture document included | Present | `02_SYSTEM_ARCHITECTURE.md` |
| Huawei Cloud deployment document included | Present | `04_HUAWEI_CLOUD_DEPLOYMENT.md` |
| Reproducibility guide included | Present | `03_REPRODUCIBILITY_GUIDE.md` |
| Data and artifacts inventory included | Present | `06_DATASETS_AND_ARTIFACTS.md` |
| Missing-items disclosure included | Present | `09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md` |
| Submission manifest included | Present | `submission_manifest.json` |

## Recommended Final ZIP Structure

The following structure is recommended for the regional submission package:

```text
Aurora_Noctua_Regional_Submission/
|-- slides/
|   `-- Template2_Aurora_Noctua_Regional.pptx
|-- code/
|   |-- README.md
|   |-- app/
|   |-- tools/
|   |-- iotda_motorbase.py
|   |-- iotdaPC.py
|   `-- iotdaRasberry.py
|-- docs/
|   `-- submission/
|       |-- 01_PROJECT_OVERVIEW.md
|       |-- 02_SYSTEM_ARCHITECTURE.md
|       |-- 03_REPRODUCIBILITY_GUIDE.md
|       |-- 04_HUAWEI_CLOUD_DEPLOYMENT.md
|       |-- 05_MODEL_IMPLEMENTATION_TRAINING_AND_INFERENCE.md
|       |-- 06_DATASETS_AND_ARTIFACTS.md
|       |-- 07_OPEN_SOURCE_EVIDENCE.md
|       |-- 08_SUBMISSION_CHECKLIST.md
|       |-- 09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md
|       `-- submission_manifest.json
|-- artifacts/
|   |-- datasets/
|   |-- model_weights/
|   `-- logs/
|       |-- training/
|       `-- inference/
`-- evidence/
    `-- open-source-repository-screenshot.png
```

## Minimum Recommended Additions Before Final Packaging

To convert this repository into a stronger regional submission ZIP, add:

- the slide deck
- the open-source screenshot
- sanitized production dataset samples
- exported AI training source or notebooks
- model weights
- training logs
- inference logs
