# Hallucination Rules

> Rule chống hallucination cho AI agent. **Luôn load** ở Phase 0 cùng PROJECT_MAP.
> Tham khảo dài hơn: `guides/hallucination-guide.md`.

---

## Rule cốt lõi: Cite source — luôn luôn

Trước khi reference bất kỳ function / method / API endpoint / DB field nào:

1. **Cite source cụ thể**: "Based on `<file>:<line>`" hoặc "Based on `schema_snapshot.yaml#<key>`"
2. Không cite được → **state uncertainty**, KHÔNG assume
3. Cụm từ `"I believe..."` / `"probably..."` / `"should work"` = **hallucination risk** → verify trước khi dùng

---

## 5 loại hallucination — phải nhận diện được

| Type | Triệu chứng | Detect | Prevent |
|------|-------------|--------|---------|
| **1. Invented API** | Method/endpoint không tồn tại | AttributeError / ImportError khi chạy | Load `schema_snapshot.yaml` + cite source |
| **2. Instruction drift** | Quên rule trong CLAUDE.md (sau ~60-80k tokens) | `post-write-check` hook bắt | Rotate session ở 80k tokens |
| **3. Confabulation** | Trả lời tự tin về thông tin không có trong context | Hỏi "based on which file?" → không cite được | `schema_snapshot.yaml` cho mọi external API |
| **4. Sycophantic agreement** | Đồng ý với assumption sai của user | Hỏi ngược "what could go wrong?" | Rule: challenge assumptions, không gật bừa |
| **5. Context contamination** | Schema/behavior từ task A nhiễm vào task B | Output reference entity ngoài scope | Khai báo rõ scope đầu task, rotate khi đổi module |

---

## Anti-hallucination mandatory rules

### Rule 1 — Verify before use

```
Trước khi dùng method/field NÀO:
  □ Có trong file đã đọc? → cite file:line
  □ Có trong schema_snapshot.yaml? → cite key
  □ Cả hai đều không → KHÔNG dùng, hỏi user hoặc đọc thêm code
```

### Rule 2 — Schema snapshot là single source of truth

`schema_snapshot.yaml` là ground truth cho **mọi external API và DB schema**.

- Phát hiện field mới chưa có trong schema → **STOP, update schema_snapshot trước**, rồi mới code
- Code reference field không có trong schema → **REJECT**, regenerate (không patch)

### Rule 3 — Nullable handling bắt buộc

Mọi field marked `nullable` trong schema_snapshot → bắt buộc dùng:
- Python: `.get("field")` hoặc `Optional[T]` + None check
- TypeScript: `?.` hoặc explicit `| undefined`
- KHÔNG bao giờ access trực tiếp như non-null

### Rule 4 — Challenge assumptions

User nói "this should work, right?" → **KHÔNG đồng ý ngay**.

Trả lời format:
```
Để verify: tôi cần đọc <file>. Sau khi đọc:
- Pros: ...
- Risks (3 cách approach này có thể fail): ...
- Decision: ...
```

### Rule 5 — Scope declaration

Đầu mỗi task lớn / mỗi sub-task, **declare scope rõ**:
```
Scope task này:
  - Module: payment/stripe
  - Files được phép đọc: src/payment/**, tests/payment/**
  - External API: Stripe (xem schema_snapshot.yaml#stripe_*)
  - KHÔNG đụng: auth/, notifications/
```

Output reference entity ngoài scope = Type 5 contamination → STOP.

---

## Recovery protocol — khi phát hiện hallucination

### Bước 1 — STOP ngay

Không build thêm code nào trên output nghi ngờ. Mỗi function viết trên nền hallucination = 3-5x token để debug sau.

### Bước 2 — Classify

```
□ AttributeError / ImportError khi chạy?      → Type 1 (invented API)
□ Vi phạm rule trong CLAUDE.md?                → Type 2 (instruction drift)
□ Claim thông tin không có trong context?      → Type 3 (confabulation)
□ Đồng ý với statement sai của user?           → Type 4 (sycophantic)
□ Mix schema/behavior từ module khác?          → Type 5 (contamination)
```

### Bước 3 — Cung cấp ground truth

```
Type 1, 3, 5: "Đây là actual code/schema: [paste]. Re-analyze."
Type 2:        "Đây là rule bị vi phạm: [rule]. Sửa lại."
Type 4:        "Challenge this: 3 cách approach này có thể fail?"
```

### Bước 4 — Update schema_snapshot.yaml

Nếu hallucination do thiếu schema:

```yaml
external_apis:
  <api_name>:
    NOT_available:
      - <field claude hay assume có nhưng không có>
    gotcha: "<mô tả ngắn>"
```

### Bước 5 — Rotate nếu session > 80k tokens

Sau hallucination + session đã dài → viết session snapshot, mở session mới. Đừng tiếp tục trong session đã bị "nhiễm".

---

## Pre-output checklist

Trước khi report Phase 5 "done", check:

- [ ] Code có cite nguồn (`file:line` hoặc `schema#key`) cho mọi external ref?
- [ ] Tất cả field access đã verify với `schema_snapshot.yaml`?
- [ ] Có method/endpoint nào tự bịa không? (chạy thử để confirm)
- [ ] Nullable fields có handle với `.get()` / `Optional` / `?.`?
- [ ] Rules trong CLAUDE.md có follow? (`post-write-check` pass?)
- [ ] Session đang ở bao nhiêu tokens? (> 80k → rotate trước khi tiếp)

---

## Dấu hiệu sớm — phát hiện trước khi code chạy

| Signal | Loại | Action ngay |
|---|---|---|
| Dùng method không có trong docs | Type 1 | Verify với actual source |
| Không cite được file khi hỏi "based on?" | Type 3 | Load actual file vào context |
| "I believe..." / "probably..." | Type 3 | Verify trước khi dùng |
| Code vi phạm rule CLAUDE.md | Type 2 | Rotate session |
| Reference field từ module khác | Type 5 | Khai báo lại scope |
| Đồng ý với mọi statement của user | Type 4 | Hỏi "what's wrong with this?" |
