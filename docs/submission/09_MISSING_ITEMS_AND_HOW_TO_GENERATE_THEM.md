# 09 Missing Items and How to Generate Them

## Purpose

This document is intentionally strict and honest. It lists the missing items that matter for a complete regional competition package, why they matter, where they should live, and how to generate or export them.

## Missing Items

| Missing item | Why it matters | Where it should live | Exact command or process to generate it | Who should provide it |
| --- | --- | --- | --- | --- |
| Template 2 slide deck | The competition explicitly requires the presentation file | `slides/Template2_Aurora_Noctua_Regional.pptx` | Create the regional competition slide deck using the official Template 2 and save it under the `slides/` folder at ZIP assembly time | Team presentation owner |
| Open-source repository screenshot | Judges require evidence that the project has been open-sourced | `docs/submission/assets/open-source-repository-screenshot.png` or `evidence/open-source-repository-screenshot.png` in the final ZIP | Open the repository page in a browser, capture a screenshot that shows the repo page, then save it using the recommended filename | Any team member with repository access |
| Final commit hash record | The submission should identify the exact code state that was open-sourced | `evidence/git-commit.txt` in the final ZIP | Run `git rev-parse HEAD > evidence/git-commit.txt` at packaging time | Release engineer |
| Optional release tag | A tag improves traceability for judges | Git and `evidence/release-tag.txt` | Run `git tag regional-submission-2026` and `git push origin regional-submission-2026`, then record the tag name in `evidence/release-tag.txt` | Release engineer |
| ModelArts training source export | Training code is part of the required submission package | `artifacts/modelarts/training/` | Export the real training notebooks or scripts from ModelArts and place them in this folder; if ModelArts was used through a notebook, download the notebook files and supporting scripts from the ModelArts workspace | AI owner |
| Saved model weights | The competition asks for model weights or saved artifacts | `artifacts/model_weights/` | Download the serialized model outputs from the real training environment or storage location and copy them into this folder | AI owner |
| Training logs | Judges may need proof that the model was trained | `artifacts/logs/training/` | Export the training job logs from ModelArts or the actual training runtime, then store the raw log bundle or text logs in this folder | AI owner |
| Inference logs | Judges may need proof of model execution or operational output generation | `artifacts/logs/inference/` | If the production backend is available, call the operational endpoint and store sample responses, for example: `curl \"https://<BACKEND_PUBLIC_URL>/api/v1/ai/operational?deviceId=<DEVICE_ID>\" > artifacts/logs/inference/ai_operational_sample.json` | Backend or AI owner |
| Sanitized telemetry sample from production MySQL | The competition asks for partial datasets | `artifacts/datasets/sample_app_telemetry_compat.csv` | Export a sanitized subset from MySQL. Example process: run a query for 100 to 500 rows from `app_telemetry_compat` for one device, remove sensitive fields, save as CSV | Database owner |
| Sanitized fault prediction sample | Needed to demonstrate the fault model data path | `artifacts/datasets/sample_ai_fault_predictions.csv` | Export 100 to 500 sanitized rows from `ai_fault_predictions` for the competition device or devices | Database or AI owner |
| Sanitized power forecast sample | Needed to demonstrate the power model data path | `artifacts/datasets/sample_ai_power_forecast.csv` | Export 100 to 500 sanitized rows from `ai_power_forecast` | Database or AI owner |
| Sanitized yaw recommendation sample | Needed to demonstrate the yaw model data path | `artifacts/datasets/sample_ai_yaw_recommendations.csv` | Export 100 to 500 sanitized rows from `ai_yaw_recommendations` | Database or AI owner |
| Nginx production config export | Deployment reproducibility is stronger when the reverse proxy config is included | `artifacts/deployment/nginx/` | Copy the active ECS Nginx site configuration into this folder, removing secrets or internal-only comments if necessary | Deployment owner |
| PM2 production config or process record | Useful for reproducible backend runtime documentation | `artifacts/deployment/pm2/` | Export the PM2 process description or create a documented process file from the ECS host | Deployment owner |
| Edge Python requirements file | The root Python scripts are reproducible but currently not pinned through a requirements file | `artifacts/edge/requirements-edge.txt` or repository root `requirements-edge.txt` | In the working Python environment, run `pip freeze > artifacts/edge/requirements-edge.txt`, then trim unrelated packages if needed | Edge developer |

## Suggested MySQL Export Process

If a MySQL shell is available, the sanitized dataset samples can be exported with a workflow like this:

```bash
mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p --database <MYSQL_DATABASE> -e "SELECT * FROM app_telemetry_compat WHERE device_id='<DEVICE_ID>' ORDER BY timestamp DESC LIMIT 200" > artifacts/datasets/sample_app_telemetry_compat.tsv
mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p --database <MYSQL_DATABASE> -e "SELECT * FROM ai_fault_predictions WHERE device_id='<DEVICE_ID>' ORDER BY prediction_time DESC LIMIT 200" > artifacts/datasets/sample_ai_fault_predictions.tsv
mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p --database <MYSQL_DATABASE> -e "SELECT * FROM ai_power_forecast WHERE device_id='<DEVICE_ID>' ORDER BY forecast_time DESC LIMIT 200" > artifacts/datasets/sample_ai_power_forecast.tsv
mysql -h <MYSQL_HOST> -u <MYSQL_USER> -p --database <MYSQL_DATABASE> -e "SELECT * FROM ai_yaw_recommendations WHERE device_id='<DEVICE_ID>' ORDER BY recommendation_time DESC LIMIT 200" > artifacts/datasets/sample_ai_yaw_recommendations.tsv
```

After export:

1. remove secrets and internal-only identifiers if necessary
2. convert TSV to CSV if required by the submission package
3. verify that the exported headers match the documented operational pipeline

## Suggested Human Workflow Before Final ZIP Export

1. Finalize and save the competition slide deck.
2. Take the open-source repository screenshot.
3. Record the final commit hash and optional release tag.
4. Export sanitized telemetry and AI table samples from MySQL.
5. Export ModelArts training sources, weights, and training logs.
6. Export one or more inference log samples.
7. Export Nginx and PM2 deployment evidence from the ECS host.
8. Assemble the final ZIP using the folder structure recommended in [08_SUBMISSION_CHECKLIST.md](08_SUBMISSION_CHECKLIST.md).
