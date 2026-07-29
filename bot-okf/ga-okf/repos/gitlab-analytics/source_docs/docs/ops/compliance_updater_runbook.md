# Compliance Updater — Runbook Vận Hành

**Module:** `src/compliance_updater`
**Cập nhật lần cuối:** 2026-04-04
**Áp dụng khi:** Tài liệu MR_Compliance_Guide_vX.X.md có thay đổi rule, trọng số, violation mới

---

## 1. Luồng hoạt động tổng quan

```
MR_Compliance_Guide_vX.X.md   ← Dev/QA chỉnh tài liệu
         │
         │  (tay: cập nhật rule mới vào spec)
         ▼
docs\mr-compliance\compliance_spec.yaml   ← source of truth machine-readable
         │
         │  python -m src.compliance_updater apply
         ▼
┌─────────────────────────────────┬─────────────────────────────────────┬────────────────┐
│ v_mr_compliance.sql             │ v_compliance_violation_detail.sql   │ thresholds.py  │
│  • scoring block (CASE pts)     │  • violation_label                  │  (full regen)  │
│  • violations array             │  • violation_category               │                │
│                                 │  • score_weight                     │                │
│                                 │  • violation_severity               │                │
└─────────────────────────────────┴─────────────────────────────────────┴────────────────┘
         │
         │  dbt run
         ▼
PostgreSQL gitlab_kpi schema  →  Metabase dashboards tự cập nhật
```

---

## 2. Các lệnh vận hành (Windows cmd)

### Bước 0 — Di chuyển vào thư mục project

```cmd
cd C:\Users\nangh\Documents\gitlab-analytics_v1\gitlab-analytics
```

### Bước 1 — Validate spec trước khi làm gì

Kiểm tra schema YAML hợp lệ, tổng điểm = 100, không có violation mồ côi.
Không ghi bất kỳ file nào.

```cmd
python -m src.compliance_updater check
```

Output kỳ vọng:
```
Spec valid: compliance_spec.yaml
  Version:    1.4 (ENG-STD-MR-002)
  Components: 10
  Violations: 10
  Max score:  100 pts
  OK — schema valid, max score = 100.
```

### Bước 2 — Preview diff giữa 2 phiên bản spec

So sánh spec cũ vs spec mới để thấy chính xác điều gì sẽ thay đổi.

```cmd
python -m src.compliance_updater diff ^
    --old-spec docs\mr-compliance\compliance_spec_v1.4.yaml ^
    --spec     docs\mr-compliance\compliance_spec.yaml
```

> **Lưu ý:** Trước khi update lên version mới, hãy copy file spec hiện tại:
> ```cmd
> copy docs\mr-compliance\compliance_spec.yaml docs\mr-compliance\compliance_spec_v1.4.yaml
> ```

### Bước 3 — Dry-run: xem trước file nào sẽ thay đổi

```cmd
python -m src.compliance_updater apply --dry-run
```

### Bước 4 — Apply thực sự

```cmd
python -m src.compliance_updater apply
```

Output kỳ vọng:
```
Apply results:
  ✓ src\transform\models\marts\v_mr_compliance.sql
      • scoring
      • violations
  ✓ src\transform\models\marts\v_compliance_violation_detail.sql
      • violation_label
      • violation_category
      • score_weight
      • violation_severity
  ✓ src\alerting\thresholds.py
      • (full file)

Backup files written as *.bak next to each modified file.
Run `dbt run` to apply the SQL changes to your database.
```

### Bước 5 — Chạy dbt để apply SQL xuống PostgreSQL

```cmd
cd src\transform
set DB_USER=analytics&& set DB_PASSWORD=123456&& set DB_HOST=localhost&& set DB_PORT=5432&& set DB_NAME=gitlab_analytics&& dbt run --profiles-dir . --target dev
```

### Bước 6 — Chạy dbt test (nếu thêm violation mới có accepted_values)

```cmd
dbt test --profiles-dir . --target dev
```

Quay lại thư mục gốc:
```cmd
cd ..\..
```

---

## 3. Kịch bản thường gặp

### A. Thay đổi trọng số (ví dụ: tăng AI Disclosure từ 5 lên 10 pts)

1. Mở `docs\mr-compliance\compliance_spec.yaml`
2. Tìm component `ai_disclosure`, sửa `pts_true: 5` → `pts_true: 10`
3. Điều chỉnh component khác để tổng vẫn = 100
4. Cập nhật `violation` `NO_AI_DISCLOSURE` → `score_weight: 10`
5. Chạy:
   ```cmd
   python -m src.compliance_updater check
   python -m src.compliance_updater apply
   ```

### B. Thêm violation mới (ví dụ: `NO_REVIEWER`)

1. Thêm field mới vào ETL (`merge_requests.py`) và staging (`stg_merge_requests.sql`): `has_reviewer`
2. Trong `compliance_spec.yaml` thêm 2 block:

   ```yaml
   # Trong score_components:
   - name: reviewer
     label: "MR phải có reviewer"
     category: convention
     type: boolean
     field: "mr.has_reviewer"
     pts_true: 5
     pts_false: 0
     violation_false: NO_REVIEWER
     comment: "ít nhất 1 reviewer được assign"

   # Trong violations:
   - code: NO_REVIEWER
     label_vi: "MR không có reviewer được assign"
     category: "Naming Convention"
     severity: REQUIRED
     score_weight: 5
     detection_sql: "not mr.has_reviewer"
   ```

3. Điều chỉnh trọng số components khác để tổng = 100
4. Chạy:
   ```cmd
   python -m src.compliance_updater check
   python -m src.compliance_updater apply
   ```

### C. Thay đổi ngưỡng MR size (ví dụ: hạ L từ 700 xuống 500)

1. Trong `compliance_spec.yaml`, sửa `thresholds.mr_size.l: 700` → `l: 500`
2. Chạy apply — `thresholds.py` và SQL size labels tự cập nhật:
   ```cmd
   python -m src.compliance_updater apply
   ```

### D. Update tài liệu lên version mới (ví dụ v1.6 → v1.7)

```cmd
rem 1. Backup spec cũ
copy docs\mr-compliance\compliance_spec.yaml docs\mr-compliance\compliance_spec_v1.6.yaml

rem 2. Chỉnh compliance_spec.yaml: version, các rule mới
rem    (dùng IDE)

rem 3. Validate
python -m src.compliance_updater check

rem 4. Xem diff
python -m src.compliance_updater diff --old-spec docs\mr-compliance\compliance_spec_v1.4.yaml --spec docs\mr-compliance\compliance_spec.yaml

rem 5. Apply
python -m src.compliance_updater apply

rem 6. dbt run
cd src\transform
set DB_USER=analytics&& set DB_PASSWORD=123456&& set DB_HOST=localhost&& set DB_PORT=5432&& set DB_NAME=gitlab_analytics&& dbt run --profiles-dir . --target dev
cd ..\..
```

---

## 4. Cấu trúc compliance_spec.yaml

```yaml
version: "1.4"
standard_code: "ENG-STD-MR-002"
updated_at: "2026-04"

score_components:       # Danh sách components tính điểm (thứ tự = thứ tự trong SQL)
  - name: ci_pass       #   name: unique key
    type: boolean       #   type: boolean | tiered_mr_size | coverage_absolute | coverage_delta
    field: "mr.ci_passed"
    pts_true: 25
    pts_false: 0
    violation_false: CI_FAILED
    comment: "..."

violations:             # Catalog vi phạm (thứ tự = thứ tự trong violation array SQL)
  - code: CI_FAILED     #   code: unique key (UPPER_SNAKE)
    label_vi: "..."     #   label tiếng Việt hiển thị trên Metabase
    category: "Quality Gate"
    severity: BLOCKER   #   BLOCKER | REQUIRED | INFO
    score_weight: 25    #   điểm trừ
    detection_sql: "not mr.ci_passed"   # SQL fragment cho array_remove block

thresholds:             # Ánh xạ sang thresholds.py
  mr_size: {xs, s, m, l}
  coverage: {green, yellow}
  coverage_delta: {drop_threshold}
  compliance_score: {pass, warning}
  ai_adoption: {target_commit_pct, target_loc_pct}
  alert: {max_per_message, dedup_hours, lookback_hours}
```

---

## 5. Các file bị ảnh hưởng khi apply

| File | Sections được replace | Không bị đụng |
|------|----------------------|---------------|
| `src\transform\models\marts\v_mr_compliance.sql` | `scoring`, `violations` | CTEs (pipeline_coverage, project_coverage_trend, join logic) |
| `src\transform\models\marts\v_compliance_violation_detail.sql` | `violation_label`, `violation_category`, `score_weight`, `violation_severity` | SELECT columns, FROM/JOIN |
| `src\alerting\thresholds.py` | Toàn bộ file | — |

Backup tự động tại: `<file>.bak` (cùng thư mục, ghi đè mỗi lần apply)

---

## 6. Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `MarkerError: Missing start marker for section 'scoring'` | Marker bị xóa khỏi SQL file | Thêm lại `-- @compliance_updater:start:scoring` vào đúng vị trí |
| `Max score: 95 pts` trong `check` | Tổng pts_true của components ≠ 100 | Điều chỉnh pts trong spec cho đúng 100 |
| `ValidationError` khi load spec | YAML sai schema | Kiểm tra indentation, type field hợp lệ |
| dbt error sau apply | SQL syntax lỗi trong generated block | Restore `.bak`, kiểm tra `detection_sql` trong spec |
