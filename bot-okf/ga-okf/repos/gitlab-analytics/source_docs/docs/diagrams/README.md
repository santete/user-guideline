---
title: Architecture Diagrams Index
project: gitlab-analytics (ENG-ANA-001)
sdd_version: v1.0
snapshot_date: 2026-05-20
notation: Mermaid (renders natively on GitHub/GitLab/Metabase preview)
---

# Architecture Diagrams — `docs/diagrams/`

Bộ diagram bám theo **C4 model** (Context → Container → Component) + sequence
diagram cho critical path. Mỗi file là Mermaid source render được trực tiếp
trên GitLab MR / GitHub PR / VS Code preview. PNG export là optional, không
required cho review.

## File list

| File | Diagram type | SDD section | Mô tả |
|---|---|---|---|
| [`c4_context.md`](./c4_context.md) | C4 Context (Level 1) | §2.1 | Hệ thống + actors + external system. Zoom out nhất. |
| [`c4_container.md`](./c4_container.md) | C4 Container (Level 2) | §2.2 | Bóc 1 system thành các container deployable (extractor, webhook, dbt, alerter, metabase, db). |
| [`c4_component_extractor.md`](./c4_component_extractor.md) | C4 Component (Level 3) | §3.1 | Zoom vào extractor container — 8 dlt resource + client + checkpoint + validator. |
| [`seq_daily_etl.md`](./seq_daily_etl.md) | Sequence | §5.1 | Critical path daily ETL 02:00 SEAST. End-to-end ≤ 2h. |

ERD database schema không nằm ở đây — đã có sẵn tại [`docs/reference/db_erd.md`](../reference/db_erd.md)
(snapshot 2026-05-20, 10 entities trong schema `gitlab_raw`).

## Render to PNG (optional)

PNG chỉ cần khi attach docx (SDD field `.png`) hoặc external doc tool không
render Mermaid. Trong-repo / GitLab MR review luôn dùng `.md` source.

```bash
# Cài 1 lần
npm install -g @mermaid-js/mermaid-cli

# Render 1 file
mmdc -i docs/diagrams/c4_context.md -o docs/diagrams/c4_context.png -t default -b white

# Render tất cả
for f in docs/diagrams/*.md; do
  [ "$f" = "docs/diagrams/README.md" ] && continue
  mmdc -i "$f" -o "${f%.md}.png" -t default -b white
done
```

`mmdc` cần Chromium — trên CSOC K8s runner phải dùng `--puppeteerConfigFile`
trỏ vào Chromium path. Trong môi trường air-gapped, render local rồi commit
PNG.

## Convention

- **Mermaid source là canonical**, PNG là derived artifact.
- Sửa diagram → sửa `.md`, không sửa `.png`.
- Mọi `.md` ở đây phải có frontmatter `title` + `snapshot_date` + `source` (file/code reference làm ground truth).
- Khi sửa: cite source giống pattern `db_erd.md` — actor / container / component nào lấy từ file/section nào trong code/spec.
- Re-render PNG sau mỗi commit thay đổi `.md` (CI job optional, hiện chưa wire).

## Ground truth references

| Diagram element | Source of truth |
|---|---|
| Tech stack versions | `CLAUDE.md` §Architecture + SDD §1.3 |
| Container topology | SDD §8.1 Deployment topology |
| Extractor resources (8) | `src/extraction/sources/*.py` (commits, group_members, merge_requests, mr_commits, mr_notes, pipeline_jobs, pipelines, test_reports) |
| GitLab API client behavior | `src/extraction/client.py` |
| Checkpoint / cursor logic | `src/extraction/checkpoint.py` + table `gitlab_raw.pipeline_state` (migration 003) |
| Pydantic schemas | `src/validation/schema_validator.py` |
| dbt models | `src/transform/models/{staging,marts}/` |
| Daily ETL critical path | SDD §5.1 + `run.py` main() + `.gitlab-ci.yml` schedule |
| Alerter flow | `src/alerting/compliance_alert.py` |
