# Kiếm Phách

Game nhịp điệu chặt chém 2.5D, bối cảnh Đại Việt kỳ ảo. Mục tiêu hiện tại: bản web trên itch.io.

## Cài đặt (một lần, trên Windows)

Cần Node.js 20 trở lên (khuyên dùng 22 LTS).

```powershell
cd D:\3D_App\game
npm install
```

## Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy thử, mở http://localhost:5173 (tự tải lại khi sửa code) |
| `npm test` | Chạy test (Vitest) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run build` | Build bản phát hành vào `dist/` |
| `npm run package:itch` | Build + kiểm tra giới hạn itch.io + nén thành `release/kiem-phach-web.zip` |

Trong game: bấm vào màn hình để bắt đầu (trình duyệt chỉ cho phát âm thanh sau một cú bấm). **J** chém/đỡ, **R** chơi lại, **`** bật/tắt bảng gỡ lỗi.

## Cấu trúc

```
src/
  audio/    AudioEngine (AudioContext, stem, SFX), SongClock — nguồn thời gian duy nhất
  rhythm/   constants (cửa sổ chấm, BEAT_UNITS), TempoMap, Beatmap (schema + kiểm tra)
  input/    Bàn phím -> sự kiện có dấu thời gian
  render/   Stage: cảnh 2.5D tạm (khối hộp), camera ngang
  core/     EventBus
  debug/    Bảng lil-gui
public/levels/  Beatmap JSON (demo.json)
tests/          Vitest
scripts/        zip-itch.mjs
docs/           Mẫu tài liệu, bảng giấy phép tài nguyên
```

Quy tắc kỹ thuật: xem `CLAUDE.md` và các skill trong `.claude/skills/` (đặc biệt `kiem-phach-rhythm`, `kiem-phach-style`).

## Trạng thái

Khung đã có: đồng hồ nhịp theo âm thanh người chơi nghe thấy, bấm phím lấy đúng thời điểm sự kiện, beatmap JSON có kiểm tra, màn cuộn khóa theo nhịp, nhạc tạm là tiếng click.

Bước tiếp theo: `Judge` (chấm Tuyệt kỹ/Tốt/Trượt, đòn giữ, nhảy, phản đòn, kết liễu, thua sau 3 lần trượt) kèm đủ test theo skill `kiem-phach-rhythm`.

## Git (nên làm)

```powershell
git init
git lfs install
git add .
git commit -m "Khung dự án Kiếm Phách"
```
