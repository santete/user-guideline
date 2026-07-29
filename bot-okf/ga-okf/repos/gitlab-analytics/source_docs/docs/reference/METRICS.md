# Framework Metrics — Design

> **TL;DR**: append-only event log tại `.claude/metrics/events.jsonl` (gitignored). Hooks ghi event tự động (fail-open). `/metrics` slash command in summary 7d/30d. Local-only mặc định, team aggregate là opt-in.

## Why

Build framework rồi mà không có số liệu thì không biết:
- Framework có giảm hallucination thực tế không?
- Rule có catch vi phạm hay chỉ tạo friction?
- Pipeline có waste context không?
- Chỗ nào cần cải thiện ưu tiên?

→ Cần observability layer **lightweight** (không gửi remote mặc định, không ảnh hưởng workflow).

## 6 metrics core

| # | Metric | Source | "Tốt" | "Cần xem lại" |
|---|---|---|---|---|
| 1 | HRS distribution (% GREEN/YELLOW/ORANGE/RED 7d) | `halluc_score` events | RED < 5%, GREEN > 70% | RED > 10% |
| 2 | Hook block rate (BLOCKER/session) | `hook_block` events | 0.5–2/session | 0 (rules vô dụng), > 5 (FP friction) |
| 3 | Token efficiency (avg final, % rotate ≥80k) | `session_end` events | avg < 60k, rotate < 20% | rotate > 40% (context bloat) |
| 4 | Phase 3 loop count (avg retries/task) | *placeholder — chưa instrument* | < 1.5 | > 2 |
| 5 | Classify frequency (lần/tháng) | `classify` events | match LOC growth | spike đột ngột |
| 6 | Schema staleness (median days) | live mtime check | < 14d | > 30d |

## Event schema

Mỗi event = 1 dòng JSON trong `.claude/metrics/events.jsonl`:

```json
{
  "ts": 1746489600,
  "event": "session_end" | "halluc_score" | "hook_block" | "rotate" | "classify",
  "pattern": "A" | "B" | "C" | "?",
  "data": { ... }
}
```

Event-specific `data`:

| Event | data fields |
|---|---|
| `session_end` | `final_tokens`, `rotated`, `session_id` |
| `halluc_score` | `hrs`, `color`, `dominant`, `schema_blocked`, `tokens`, `token_source`, `files_count` |
| `hook_block` | `hook` (post-write-check / block-dangerous), `rule`, `file` hoặc `command`, `severity` |
| `classify` | `pattern_recommended`, `loc`, `deployment_context` |
| `rotate` | `tokens_at_rotate`, `session_summary_path` |

## Collection mechanism

| Hook | When | Source |
|---|---|---|
| `Stop` (settings.json) | Cuối mỗi session | `.claude/hooks/python/session-end.py` |
| `PreToolUse: Bash` | Block dangerous command | `.claude/hooks/python/block-dangerous.py` (inject) |
| `PostToolUse: Edit\|Write` | Block code violation | `.claude/hooks/python/post-write-check.py` (inject) |
| `/halluc-score` | Every run (manual trigger) | `.claude/hooks/python/halluc-score.py` (inject) |
| `/classify` | When user runs | TODO — slash command instructs Claude to call `metrics_writer` (P2) |
| `/rotate` | When user rotates | TODO (P2) |

**Fail-open invariant**: `metrics_writer.write_event()` wrap toàn bộ trong try/except — exception không bao giờ raise. Một event mất = mất 1 dòng metric, KHÔNG block hook hoặc session.

## Surface

### `/metrics` slash command

```bash
python .claude/hooks/python/metrics-summary.py --days 7
```

Output:
```
══════════════════════════════════════════════════════════════
  FRAMEWORK METRICS — last 7 days  [142 events, pattern B]
══════════════════════════════════════════════════════════════

  [1] Sessions:           18
      Avg final tokens:    47,200  🟢  (target < 60k)
      Rotate rate (≥80k):    11.1%  🟢  (target < 20%)

  [2] HRS distribution (12 runs):
      🟢 GREEN     8 ( 66.7%) █████████████
      🟡 YELLOW    3 ( 25.0%) █████
      🟠 ORANGE    1 (  8.3%) █
      🔴 RED       0 (  0.0%)

  [3] Hook blocks:
      Per session:         1.22   🟢  (target 0.5–2)
      post-write-check     18
      block-dangerous       4
      Top rules:
        console.log/debug             7
        Hardcoded API key             4
        ...

  [5] Classify runs:      2
  [6] Schema staleness:   8d  🟢  (target < 14d)
```

### Statusline (P2)

Sẽ add 1 token nhỏ: `HRS-7d 0.28 🟢` — read pre-computed cache (statusline phải fast < 50ms).

## Privacy + storage

- **Local-only mặc định**: `events.jsonl` ghi vào `.claude/metrics/`, gitignored.
- **PII risk**: events có `file_path` (post-write-check) và `command` (block-dangerous). Nếu sensitive → user redact trước khi share.
- **Storage**: ~50 events/day × 200 bytes = 10 KB/day = 3.6 MB/year. Negligible. Auto-prune nếu > 100 MB (TODO P2).

## Team aggregation (opt-in)

Manual workflow nếu team muốn so sánh:
1. User chạy `python .claude/hooks/python/metrics-summary.py --json --days 30 > my-metrics.json`
2. Redact path/command nếu cần (`jq`)
3. Push lên shared dashboard (Grafana, custom internal)

Framework KHÔNG ship remote telemetry — compliance-safe (PCI/SOC2).

## Roadmap

- **P1 (done)**: events.jsonl + 4 events + `/metrics` summary + Stop hook + Python parity
- **P2**: instrument `/classify` + `/rotate` events, statusline HRS-7d badge, auto-prune log
- **P3**: Phase 3 loop count (cần instrument pipeline runner — non-trivial)
- **P4**: Bash + Node parity cho `metrics_writer` (currently Python-only)

## Liên quan

- `.claude/hooks/python/metrics_writer.py` — shared writer
- `.claude/hooks/python/metrics-summary.py` — summarizer CLI
- `.claude/commands/metrics.md` — slash command spec
- `.claude/metrics/events.jsonl` — event log (gitignored)
