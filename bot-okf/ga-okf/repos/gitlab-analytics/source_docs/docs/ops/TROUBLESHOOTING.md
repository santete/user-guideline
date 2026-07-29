# Troubleshooting — debug framework khi dev gặp vấn đề

> File này dành cho dev (hoặc người support dev) khi triển khai framework và gặp lỗi.
> Mục tiêu: biết **collect info ở đâu** + **prompt Claude thế nào** để fix nhanh.
>
> 💡 **Shortcut**: `/diagnose "<symptom>"` đóng gói toàn bộ flow Phần 2 + Phần 3 + Phần 4 (collect + classify + propose root cause, KHÔNG auto-patch). Xem `.claude/commands/diagnose.md`.

---

## Phần 1 — Info collection: dữ liệu sống ở đâu

### 1.1. Framework state (cross-session, persistent)

| File / Folder                              | Chứa gì                                                | Khi nào quan tâm                |
|--------------------------------------------|--------------------------------------------------------|---------------------------------|
| `.claude/memory/project_state.yaml`        | Pattern, last task, decisions, known_gotchas, pending_tasks, hallucination_history, consecutive_failures, loc_at_classification, next_review_threshold | Phase 0 fail / pattern sai / loop nhiều |
| `.claude/memory/schema_snapshot.yaml`      | Ground truth API/DB + NOT_available list + mtime       | HRS schema_match thấp / external ref bịa |
| `.claude/memory/architecture.md`           | ADR log (immutable, append-only)                       | Quyết định cũ bị break          |
| `.claude/memory/session_YYYYMMDD.md`       | Snapshot mỗi session (do `/rotate` viết)               | Truy lại session cũ             |
| `.claude/settings.json`                    | Hook stack đang dùng + permission rules               | Hook không fire / fire sai stack |
| `.claude/agents/<role>.md`                 | (Pattern C) frontmatter + system prompt 6 agent roles | Sub-agent behavior sai          |
| `CLAUDE.md`                                | Pipeline 6-phase + Reference Map + Hard Stops + Loop Logic | AI không follow workflow      |
| `docs/ai/*.md`                             | Rule modules (CODING, SECURITY, HALLUC, ...)           | Rule không apply / soft enforcement drift |

### 1.2. Native Claude Code state (machine-local)

| Path                                                     | Chứa gì                                                |
|----------------------------------------------------------|--------------------------------------------------------|
| `~/.claude/projects/<encoded-path>/<session-uuid>.jsonl` | **Session transcript đầy đủ** — full message + tool call history |
| `~/.claude/settings.json`                                | User-level settings (override project)                 |
| `~/.claude/auto-memory/...`                              | Auto-memory machine-local (không git share)            |

> 💡 `<session-uuid>.jsonl` là tài nguyên debug **giá trị nhất** khi dev báo "AI làm sai gì đó". Có toàn bộ hội thoại + tool call.

### 1.3. Hook output

| Loại                        | Khi nào xem                              | Cách lấy                              |
|-----------------------------|------------------------------------------|---------------------------------------|
| Hook stderr                 | Claude Code show inline khi block        | Surface trực tiếp ở UI                |
| Hook exit code              | 0=pass, 1=block, 2=block-dangerous       | Xem trong session jsonl               |
| Hook latency                | Hook chạy chậm                           | `time bash tests/run-all.sh`          |

### 1.4. HRS diagnostics

| Lệnh                                                | Output                                               |
|-----------------------------------------------------|------------------------------------------------------|
| `/halluc-score`                                     | Color + dominant signal + summary                    |
| `python .claude/hooks/python/halluc-score.py --files <files> --tokens <n> --json` | JSON đầy đủ 7 signal + details |
| `project_state.yaml#hallucination_history`          | Last 50 lần chạy HRS (trend over time)               |

### 1.5. Self-test diagnostic

```bash
# Env probe + full test
bash tests/run-all.sh

# Chỉ env probe (không chạy test)
bash tests/run-all.sh --check-env-only   # nếu có flag, hoặc đọc đầu output run-all
```

Output env probe cho biết: bash version, python + pyyaml status, node version, jq presence. Đây là diagnostic đầu tiên khi dev báo "không chạy được".

### 1.6. Git + filesystem state

```bash
# Pattern threshold check
git ls-files | xargs wc -l 2>/dev/null | tail -1

# Schema staleness
ls -la .claude/memory/schema_snapshot.yaml

# Memory file YAML syntax
python -c "import yaml; yaml.safe_load(open('.claude/memory/project_state.yaml'))"

# Hooks executable + readable
ls -la .claude/hooks/python/ .claude/hooks/bash/ .claude/hooks/nodejs/
```

---

## Phần 2 — One-shot diagnostic collection

Khi dev báo lỗi mơ hồ, chạy script dưới để collect tất cả info vào 1 file dễ share:

```bash
# Run từ project root
{
  echo "═══════════ DIAGNOSTIC REPORT ═══════════"
  echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "PWD:  $(pwd)"
  echo ""

  echo "── 1. Env ──────────────────────────────"
  bash --version | head -1
  python3 --version 2>/dev/null || python --version 2>/dev/null || echo "python: MISSING"
  python3 -c 'import yaml; print("pyyaml:", yaml.__version__)' 2>/dev/null \
    || python -c 'import yaml; print("pyyaml:", yaml.__version__)' 2>/dev/null \
    || echo "pyyaml: MISSING"
  node --version 2>/dev/null || echo "node: MISSING"
  jq --version 2>/dev/null || echo "jq: MISSING (winget install jqlang.jq + restart shell)"
  echo ""

  echo "── 2. Project state ────────────────────"
  cat .claude/memory/project_state.yaml 2>/dev/null || echo "(no project_state.yaml)"
  echo ""

  echo "── 3. Schema snapshot meta ─────────────"
  ls -la .claude/memory/schema_snapshot.yaml 2>/dev/null || echo "(no schema)"
  echo ""

  echo "── 4. Settings (hook stack) ────────────"
  cat .claude/settings.json 2>/dev/null || echo "(no settings)"
  echo ""

  echo "── 5. LOC vs threshold ─────────────────"
  echo "Total LOC: $(git ls-files 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')"
  grep -E 'loc_at_classification|next_review_threshold' .claude/memory/project_state.yaml 2>/dev/null
  echo ""

  echo "── 6. Hooks files present ──────────────"
  ls .claude/hooks/python/ 2>/dev/null
  ls .claude/hooks/nodejs/ 2>/dev/null
  ls .claude/hooks/bash/ 2>/dev/null
  echo ""

  echo "── 7. Last session snapshot ────────────"
  ls -t .claude/memory/session_*.md 2>/dev/null | head -1 | xargs cat 2>/dev/null | head -50
  echo ""

  echo "── 8. Self-test result ─────────────────"
  if [ -f tests/run-all.sh ]; then
    bash tests/run-all.sh 2>&1 | tail -20
  elif [ -f ../tests/run-all.sh ]; then
    bash ../tests/run-all.sh 2>&1 | tail -20
  else
    echo "(tests/ not in project — skipped. Copy from framework: cp -r config-harness-for-claude-code/tests <project>/)"
  fi
} > /tmp/framework-diag-$(date +%s).txt 2>&1

echo "Report saved: /tmp/framework-diag-*.txt"
```

→ Dev gửi file output này khi escalate. Đủ context cho 90% issue.

---

## Phần 3 — Prompting Claude để hỗ trợ dev

### 3.1. Template prompt khi dev nhờ Claude debug

Khi dev có vấn đề, copy template dưới vào Claude (paste trong project có framework):

```
Tao đang gặp vấn đề với Config Harness framework. Help me debug.

## Symptom
<mô tả chính xác — ví dụ: "Hook không block khi tao chạy `rm -rf /tmp`",
"AI không cite source trong Phase 1", "/halluc-score report RED trên code clean">

## What I tried
<đã thử fix gì>

## Diagnostic info
<paste output của diagnostic script ở Phần 2>

## What I want
<output mong đợi>

Đọc:
1. `.claude/memory/project_state.yaml`
2. `.claude/settings.json`
3. `CLAUDE.md` Reference Map
4. `core/docs/TROUBLESHOOTING.md` (nếu có)

Phân tích root cause + đề xuất fix. KHÔNG patch trực tiếp — output spec/plan để tao review.
```

### 3.2. Template prompt khi dev báo "AI không follow rule"

```
AI không tuân rule X (ví dụ: vẫn log PAN dù có PCI_DSS_RULES.md).

## Rule expected
<file rule + nội dung>

## Behavior actual
<AI làm gì sai>

## Diagnostic
1. Check `CLAUDE.md` Reference Map có entry cho rule file không
2. Check rule file có tồn tại + readable không
3. Check `project_state.yaml#hallucination_history` xem có pattern drift không
4. Đánh giá: rule này đang ở SOFT layer hay HARD?
   - SOFT (markdown): probabilistic — có thể drift, đề xuất upgrade lên HARD
   - HARD (hook): deterministic — chỉ ra hook nào miss case này

Output: root cause + đề xuất (soft fix hoặc hook upgrade).
```

### 3.3. Template prompt khi HRS sai

```
/halluc-score đang sai (false positive RED hoặc false negative GREEN).

## Code under test
<paste path + brief>

## HRS output
<paste full JSON từ halluc-score --json>

## Expected
<color + reason>

## Diagnostic
1. Check signals individually — signal nào dominant?
2. Schema staleness: `ls -la .claude/memory/schema_snapshot.yaml`
3. Cite coverage: count cite-source markers in code
4. Confidence words: count "I think / probably / maybe"

Output: root cause + tune threshold hoặc fix code.
```

---

## Phần 4 — Common issues cheatsheet

| Symptom                                  | Likely root cause                          | Where to look                              | Fix direction                       |
|------------------------------------------|--------------------------------------------|--------------------------------------------|--------------------------------------|
| Hook không fire                          | settings.json sai stack hoặc path          | `.claude/settings.json`                    | Đổi command path / cài stack thiếu  |
| Hook fire nhưng không block              | Hook exit code sai (0 thay vì 1/2)         | Test riêng hook bằng `tests/test-hooks.sh` | Fix exit code trong hook script     |
| `bash tests/run-all.sh` skip stack       | Dependency thiếu (python/node/jq)          | Env probe đầu test output                  | Cài dependency hoặc accept skip     |
| AI không follow rule trong markdown      | Rule là SOFT, agent drift                  | `docs/ai/<RULE>.md`                        | Upgrade rule sang HARD bằng hook    |
| AI không cite source                     | Phase 1 prompt chưa enforce                | `CLAUDE.md` Phase 1                        | Re-emphasize cite rule, run /halluc-score |
| Pattern wrong (B nhầm thành A)           | LOC threshold sai trong project_state      | `project_state.yaml`                       | Re-run `/classify`                  |
| /halluc-score RED trên code clean        | Schema stale, cite coverage thấp           | `signals` trong JSON output                | Update schema, add cite tags        |
| /halluc-score GREEN trên code có hallu   | Schema không có field, cite_coverage cao   | Field reference vs schema_snapshot         | Update schema NOT_available list    |
| Memory file YAML corrupt                 | Manual edit sai indent                     | `python -c "import yaml; yaml.safe_load(...)"` | Restore từ git log              |
| Session token > 80k không rotate         | Loop Logic bị skip                         | Last session jsonl                         | Manual `/rotate`                    |
| Pattern C agent code thay vì design      | Tool restriction missing                   | `.claude/agents/<role>.md` frontmatter     | Re-strip Write/Edit từ tools list   |
| Hook chậm (> 1s)                         | mypy / static check trong hook             | Hook script                                | Disable static_errors signal nếu cần |
| Schema_snapshot.yaml file lock           | Process khác đang ghi                      | `lsof` (Linux/macOS) / Process Explorer (Win) | Kill process / restart           |

---

## Phần 5 — Escalation path

Nếu dev đã thử các fix ở Phần 4 mà không xong:

1. **Run diagnostic script** (Phần 2) → save file
2. **Get session jsonl**: `~/.claude/projects/<encoded>/<uuid>.jsonl` — last session
3. **Get framework version**: commit hash của template được copy vào project
4. **Reproduce minimal**: cố gắng tách thành test case nhỏ trong `tests/fixtures/`
5. **Open issue** với:
   - Diagnostic file
   - Last 200 lines của session jsonl (hoặc full nếu sensitive đã redact)
   - Steps to reproduce
   - Expected vs actual behavior

> Sensitive data: redact secrets, PII, internal hostnames trước khi share.

---

## Phần 6 — Self-help: dev tự diagnose 5 phút

```bash
# Step 1: Test framework chạy được không
bash tests/run-all.sh
# → Pass 63/63? Framework OK. Vấn đề là project-specific.
# → Fail? Xem env probe + fix dependency.

# Step 2: Validate memory files
python -c "import yaml; print('OK' if yaml.safe_load(open('.claude/memory/project_state.yaml')) else 'EMPTY')"
python -c "import yaml; print('OK' if yaml.safe_load(open('.claude/memory/schema_snapshot.yaml')) else 'EMPTY')"

# Step 3: Test hook trực tiếp với input giả
echo '{"tool_input":{"command":"rm -rf /"}}' | python .claude/hooks/python/block-dangerous.py
# Expect: exit 2, stderr với BLOCKED message

# Step 4: Run /halluc-score lên file đang nghi vấn
/halluc-score
# → Đọc dominant signal để biết direction

# Step 5: Compare session token vs threshold
grep "session_count\|last_successful_task" .claude/memory/project_state.yaml
```

Nếu 5 bước trên pass mà vẫn lỗi → Phần 5 escalate.

---

*File này là tài liệu support — update khi gặp issue mới chưa cover. Mỗi sự cố mới = 1 row vào Phần 4 cheatsheet.*
