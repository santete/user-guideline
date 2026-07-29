---
title: Hướng dẫn phối hợp Dev — DBA — DevOps cho deploy prod
project: gitlab-analytics
version: 1.0
audience: Dev lead, DBA, DevOps
last_updated: 2026-05-29
status: living doc — update mỗi lần phát hiện gap mới
companion_to: docs/ops/DEPLOYMENT.md (technical steps), docs/ops/devops_questions.md (open questions)
---

# Hướng dẫn phối hợp 3 bên — Dev / DBA / DevOps

> Doc này KHÔNG phải runbook deploy (xem `DEPLOYMENT.md`). Đây là
> **playbook phối hợp** — ai làm gì, khi nào, handoff artifact nào,
> escalation tree khi sự cố. Mục tiêu: deploy prod mượt, không
> nghẽn ở handoff, không đẩy việc qua lại lúc 2h sáng.

## 1. RACI tổng quan

> **R** = Responsible (làm), **A** = Accountable (chịu trách nhiệm cuối),
> **C** = Consulted (hỏi ý kiến), **I** = Informed (báo cho biết).

| Hạng mục | Dev | DBA | DevOps |
|---|:---:|:---:|:---:|
| Application code (`src/**`) | R, A | I | I |
| dbt models + tests | R, A | C | I |
| DB migration SQL (`src/infra/db/migrations/`) | R | A | C |
| DB instance (postgres prod) | I | R, A | C |
| DB backup/restore policy | C | R, A | I |
| Postgres version + extensions | I | R, A | C |
| Secrets material (token, password) | C | C | R, A |
| Secret storage (Vault) | I | I | R, A |
| Image build pipeline (CI) | C | I | R, A |
| Image registry (Harbor) | I | I | R, A |
| K8s cluster + manifests deploy | I | I | R, A |
| CronJob schedule + resource limits | C | C | R, A |
| Observability (Prom/Grafana/AM/Loki) | I | C | R, A |
| Slack webhook routing | C | I | R, A |
| Incident response (ETL fail) | R | C | A |
| Incident response (DB fail) | I | R, A | C |
| Incident response (cluster fail) | I | C | R, A |

## 2. Handoff artifacts — ai cung cấp gì cho ai

### Dev → DBA (trước khi deploy lần đầu, lặp lại khi schema đổi)

| Artifact | Format | Khi nào | Mục đích |
|---|---|---|---|
| Danh sách migration sẽ chạy | `src/infra/db/migrations/0XX_*.sql` (link MR) | T-7 ngày | DBA review SQL (locking, full scan, partition strategy) |
| ERD + data model | `docs/reference/db_erd.md` | One-time + khi đổi | DBA hình dung scale + index plan |
| Growth projection | `docs/ops/DB_ARCHIVE_STRATEGY.md` §1-2 | One-time + 6 tháng/lần | DBA cấp storage + plan archive |
| Query pattern hot path | Top 5 query + `EXPLAIN ANALYZE` | T-3 ngày | DBA tune index, suggest pg config |
| Connection pool requirement | max_connections, idle timeout | T-3 ngày | DBA cấp pgbouncer hoặc raise limit |
| User/role needed | `analytics_rw`, `analytics_ro`, `metabase_ro` | T-3 ngày | DBA tạo role + grant |

### DBA → Dev + DevOps

| Artifact | Format | Khi nào | Mục đích |
|---|---|---|---|
| Connection string template | `postgresql://USER:PASS@HOST:PORT/DB` | T-3 ngày | Dev cập nhật `.env.example`; DevOps tạo K8s Secret |
| Postgres version + extension list | `pg_version`, `pg_extension` snapshot | One-time | Dev verify compatibility (dlt ≥ pg13) |
| Network reachability | host + port + cluster CIDR whitelisted? | T-1 ngày | DevOps test connectivity từ namespace |
| Backup window + RPO/RTO | text policy | T-7 ngày | Dev/DevOps lên lịch ETL tránh window |
| Maintenance window | day-of-week + hour range | One-time + thay đổi | Devops schedule CronJob tránh |
| Read replica endpoint (nếu có) | host:port | T-3 ngày | Dev route Metabase + dbt-test sang replica |

### Dev → DevOps

| Artifact | Format | Khi nào | Mục đích |
|---|---|---|---|
| Image build context | `Dockerfile`, `pyproject.toml` | Mọi MR | CI build `etl:<sha>` |
| Env vars list | `.env.example` (16 keys) | Khi thêm/đổi | DevOps cập nhật ConfigMap + Secret |
| Secret keys cần có | `GITLAB_TOKEN`, `DATABASE_URL`, `SLACK_WEBHOOK_URL`, … | One-time + khi đổi | DevOps map từ Vault → ExternalSecret |
| CronJob schedule + resource | bảng schedule + CPU/mem/deadline | Khi thêm CronJob mới | DevOps render `cronjob-*.yaml` |
| Health check endpoint | DB query / HTTP endpoint | One-time | DevOps cấu hình liveness/freshness alert |
| Migration runner contract | `python -m src.infra.db.migrate` idempotent | One-time | DevOps gọi từ pre-deploy job |
| Rollback procedure | `docs/ops/DEPLOYMENT.md §4` | One-time + cập nhật | DevOps biết cách revert |

### DevOps → Dev + DBA

| Artifact | Format | Khi nào | Mục đích |
|---|---|---|---|
| Harbor registry URL + project path | URL | One-time | Dev cập nhật `kustomization images:` |
| K8s namespace + ServiceAccount | yaml | One-time | Dev biết SA cho RBAC + Vault auth |
| Vault path + auth method | text (vd `gitlab-analytics/<key>`, k8s SA JWT) | One-time | Dev viết ExternalSecret CR |
| Argo CD App path | repo + branch + manifest dir | One-time | Dev đẩy thay đổi vào đúng path |
| Cluster CIDR + egress IP | text | One-time | DBA whitelist firewall |
| Grafana board URLs | URL | Sau khi build | Dev/DBA bookmark |
| Slack channel routing | `#compliance-violation`, `#data-ops-alerts` | One-time | Dev cấu hình webhook env |

## 3. Pre-prod readiness checklist (joint sign-off)

Cả 3 phải tick HẾT trước khi mở `deploy:k8s-manifests` job (manual gate):

### Dev sign-off
- [ ] `pytest tests/` PASS local + CI (per R-AUTOGATE-001)
- [ ] `dbt run` + `dbt test` PASS trên staging DB
- [ ] Migration mới đã test trên DB clone (DBA cấp dump)
- [ ] `schema_snapshot.yaml` updated nếu API GitLab có field mới
- [ ] `.env.example` cập nhật nếu có env var mới
- [ ] MR đã merge vào main (per `01_MR_Compliance.md`)
- [ ] DEPLOYMENT.md §4 Rollback đã review + diễn tập 1 lần
- [ ] Đã báo DevOps schedule deploy + window

### DBA sign-off
- [ ] Migration SQL review xong (locking, partition, FK impact)
- [ ] Backup gần nhất < 24h trước deploy
- [ ] Storage projection 3 tháng tới có headroom > 30%
- [ ] Connection slot reserve cho ETL (số worker × max_in_flight)
- [ ] Role `analytics_rw`, `analytics_ro`, `metabase_ro` đã tạo + grant
- [ ] Read replica lag < 5s (nếu có replica)
- [ ] Đã confirm với DevOps cluster CIDR đã whitelist

### DevOps sign-off
- [ ] Vault path đã tạo + populated 16 keys
- [ ] ExternalSecret CR render OK trên staging cluster
- [ ] Harbor có image `etl:<commit_sha>` + scan PASS
- [ ] K8s namespace + RBAC + ServiceAccount tạo xong
- [ ] CronJob manifests `kustomize build` không lỗi
- [ ] Prometheus scrape + Alertmanager route test PASS
- [ ] Argo CD App đã sync staging
- [ ] Slack webhook test message gửi được tới channel target

### Joint sign-off (cả 3 cùng có mặt)
- [ ] Smoke run staging: 1 CronJob trigger thủ công, log Succeeded, raw count tăng
- [ ] Diễn tập rollback: 1 lần revert image tag + verify DB không corrupt
- [ ] Lên lịch cụ thể: ngày X giờ Y, ai online standby, channel war room

## 4. Deployment day timeline (D-Day, ~2h)

Phân chia theo block thời gian. Trước mỗi block, người chịu trách nhiệm
broadcast `STARTING <block>` ở war room channel; sau khi xong broadcast
`DONE <block> + smoke OK/FAIL`.

| Time | Role | Action | Verify |
|---|---|---|---|
| T-0h:30 | All | War room channel ON | Cả 3 confirm presence |
| T-0h:15 | DBA | `pg_dump` snapshot gần nhất | dump file size hợp lý |
| T-0h:00 | DevOps | Apply migration via pre-deploy Job (`python -m src.infra.db.migrate`) | Job Succeeded, DBA xác nhận schema |
| T+0h:10 | DevOps | `kubectl apply -k deploy/k8s/` (manifests) | All CronJobs Created, no error |
| T+0h:15 | Dev | Trigger smoke: `kubectl create job --from=cronjob/etl-ops-triage smoke-<ts>` | Pod Succeeded, log HEALTHY state |
| T+0h:30 | Dev | Trigger 1 backfill cycle: `kubectl create job --from=cronjob/etl-ops-extract-backfill bf-<ts>` | Row count tăng đúng kỳ vọng |
| T+1h:00 | Dev | `dbt run` end-to-end qua CronJob | 33/33 models PASS |
| T+1h:15 | Dev | `dbt test` | Tests PASS |
| T+1h:30 | DevOps | Un-suspend daily CronJobs (`kubectl patch cronjob/etl-daily-pipeline -p '{"spec":{"suspend":false}}'`) | next-scheduled timestamp đúng |
| T+1h:45 | All | Joint smoke: chờ first scheduled run | Pod Succeeded, Slack quiet (no false alert) |
| T+2h:00 | All | Sign-off green, war room close | DEPLOYMENT.md §8 đánh dấu |

## 5. Day-2 ops — escalation tree

```
ETL CronJob fail (Pod Failed/OOMKilled/Deadline)
    ↓
Slack #data-ops-alerts (DevOps watches)
    ↓
DevOps triage 5 phút:
    ├─ k8s/image issue (ImagePullBackOff, OOMKilled, scheduling)
    │    → DevOps own, có thể patch resource on the fly
    └─ application issue (Python exception, dbt fail, query timeout)
         → escalate Dev (consecutive_failures ≥ 3 → page)
              ↓
         Dev triage 15 phút:
              ├─ Code bug → fix + MR + redeploy
              ├─ GitLab API drift → update Pydantic + schema_snapshot
              └─ DB issue (timeout, lock, FK violation)
                   → escalate DBA
                        ↓
                   DBA xử lý:
                        ├─ Lock/long query → kill + analyze
                        ├─ Disk full → archive + extend
                        ├─ Replication lag → fail over hoặc wait
                        └─ Corruption → restore từ backup (RTO theo SLA)
```

**SLA tham chiếu** (cần DBA/DevOps confirm):
- ETL stale > 25h → P3 (next business day)
- consecutive_failures ≥ 3 → P2 (4h)
- DB unreachable > 15 phút → P1 (1h, page DBA)
- Cluster down > 30 phút → P1 (page DevOps)

## 6. Communication channels & cadence

| Kênh | Mục đích | Người trong | Cadence |
|---|---|---|---|
| Slack `#gitlab-analytics-prod` | War room + announce | Dev lead, DBA primary, DevOps primary | Always-on |
| Slack `#data-ops-alerts` | Automated alert (ETL fail, freshness) | DevOps + Dev | Real-time |
| Slack `#compliance-violation` | Business alert (MR violation) | QA Manager + Eng Manager | Real-time |
| Slack `#db-alerts` | DB-side alert (replication, disk) | DBA + DevOps | Real-time |
| GitLab MR review | Code/migration review | All 3 (cross-review) | Per MR |
| Weekly sync 30 phút | Tuần qua + tuần tới + blockers | All 3 | Thứ Hai 10:00 |
| Monthly capacity review | Storage + query latency + headroom | DBA chủ trì, Dev/DevOps tham gia | Đầu tháng |

## 7. Anti-patterns — KHÔNG được làm

### Dev không được
- ❌ Apply migration trực tiếp lên prod DB (phải qua DevOps Job + DBA confirm)
- ❌ Hardcode credential trong code (CLAUDE.md constraint #1)
- ❌ Đổi env var name mà không update `.env.example` + báo DevOps trước
- ❌ Skip `dbt test` "vì gấp"
- ❌ Push image với tag `latest` (luôn dùng `<commit_sha>`)

### DBA không được
- ❌ Đổi schema (rename column, drop table) mà không qua migration của Dev
- ❌ Revoke role mà không báo Dev trước (Metabase + ETL sẽ chết)
- ❌ Run `VACUUM FULL` trong giờ làm việc (locking)
- ❌ Backup-as-code chưa version → mất khi rotate người

### DevOps không được
- ❌ Rotate secret mà không báo Dev (ETL fail ngay vòng kế)
- ❌ Patch resource limit của CronJob xuống mà không test workload
- ❌ Đổi image tag prod thủ công bypassing Argo CD/CI (drift)
- ❌ Disable alert vì "noisy" mà không root-cause (mặc định: cải thiện threshold per `thresholds.py`)
- ❌ Suspend CronJob mà không note lý do + ETA un-suspend

### Cả 3 không được
- ❌ Deploy thứ Sáu chiều
- ❌ Deploy không có rollback đã diễn tập
- ❌ Deploy mà 1 trong 3 vắng mặt (không ai cover được role kia)
- ❌ Đẩy việc qua lại trong incident — escalation tree là final word

## 8. Onboarding checklist (người mới vào 1 trong 3 role)

### Dev mới
- [ ] Đọc `CLAUDE.md` (root) + `docs/ai/PROJECT_MAP.md`
- [ ] Clone repo, chạy local stack: `docker compose up` + `python -m src.extraction.pipeline` smoke
- [ ] Đọc 4 doc cốt lõi: `DEPLOYMENT.md`, `DB_ARCHIVE_STRATEGY.md`, `ops_runbook.md`, doc này
- [ ] Pair 1 MR với senior Dev (cross-review + walk through R-AUTOGATE-001)

### DBA mới
- [ ] Nhận handover doc: connection info, backup schedule, query top-10, growth chart
- [ ] Đọc `src/infra/db/migrations/` từ 001 → mới nhất (hiện 014)
- [ ] Đọc `DB_ARCHIVE_STRATEGY.md`
- [ ] Pair 1 migration review với senior DBA hoặc Dev lead

### DevOps mới
- [ ] Nhận handover: Vault path, Harbor URL, Argo CD App, K8s namespace, cluster URL
- [ ] Đọc `deploy/k8s/` từng manifest (khi có)
- [ ] Đọc `docs/ops/devops_questions.md` để biết các open question
- [ ] Pair 1 deploy staging với senior DevOps

## 9. Living doc — cập nhật khi nào

Cập nhật doc này khi:
- Có gap handoff phát hiện trong incident (post-mortem action)
- Có role/responsibility mới (thêm SRE? thêm Data Engineer?)
- Đổi stack technology (vd thay Vault → AWS Secrets Manager)
- Đổi cluster (move on-prem → cloud)

Mỗi update bump `version` trong frontmatter + 1 dòng changelog cuối file.

## Changelog

- **v1.0 — 2026-05-29**: Initial draft. Companion to `DEPLOYMENT.md`.
  Sources: Pattern B agent split, `.claude/CLAUDE.md` constraints,
  R-AUTOGATE-001 4-layer enforcement plan, `devops_questions.md` Q1-Q7.
