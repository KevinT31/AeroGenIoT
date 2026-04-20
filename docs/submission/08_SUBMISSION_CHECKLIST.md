# 08 Submission Checklist

## Evaluator-Facing Checklist

| Submission item | Status | Notes |
| --- | --- | --- |
| Template 2 presentation slides included | Missing | Placeholder documented, but slide deck is not in the repository |
| Source code included | Present | Backend, dashboard, mobile, edge scripts, and tools are present |
| Model implementation included | Partial | Operational AI integration is present, but training exports are not |
| Training code included | Missing | No ModelArts training scripts or notebooks were found in the repository |
| Inference code included | Partial | Backend operational AI integration is present; standalone inference runner is not |
| Dataset samples included | Partial | Two telemetry CSV files are present, but sanitized production DB exports are missing |
| Model weights included | Missing | No serialized model artifacts found |
| Training logs included | Missing | No training log bundle found |
| Inference logs included | Missing | No dedicated inference log bundle found |
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
