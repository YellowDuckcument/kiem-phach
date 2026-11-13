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

Đồ hoạ nhân vật (rối cắt giấy): Gemini tạo tấm mảnh rời trên nền xanh (xem `docs/art-elements.xlsx`), rồi

```powershell
python scripts/art/build_rig.py "D:/3D_App/assets/rig full body main.png" public/art/phach phach
```

tách nền, tìm khớp và xuất `public/art/phach/phach.png` + `phach.rig.json`. Xem và chỉnh tư thế ở http://localhost:5173/rig.html (chỉ có khi `npm run dev`).

Trong game: bấm vào màn hình để bắt đầu (trình duyệt chỉ cho phát âm thanh sau một cú bấm). **J** chém/đỡ (giữ J cho đòn giữ), **Space** nhảy, **K** phản đòn/kết liễu, **R** chơi lại, **`** bật/tắt bảng gỡ lỗi.

## Cấu trúc

```
src/
  audio/    AudioEngine (AudioContext, stem, SFX), SongClock — nguồn thời gian duy nhất
  rhythm/   constants (cửa sổ chấm, Khí thế, luật), TempoMap, Beatmap, Judge
  combat/   Course: đường đi, dừng lại khi gặp địch (theo phách)
  input/    Bàn phím -> sự kiện có dấu thời gian
  render/   Stage: cảnh 2.5D tạm, địch lao vào chém theo nhịp, vòng tín hiệu
  core/     EventBus
  debug/    Bảng lil-gui
public/levels/  Beatmap JSON (demo.json)
tests/          Vitest
scripts/        zip-itch.mjs
docs/           Mẫu tài liệu, bảng giấy phép tài nguyên
```

Quy tắc kỹ thuật: xem `CLAUDE.md` và các skill trong `.claude/skills/` (đặc biệt `kiem-phach-rhythm`, `kiem-phach-style`).

## Trạng thái

Đã có: đồng hồ nhịp theo âm thanh người chơi nghe thấy, bấm phím lấy đúng thời điểm sự kiện, beatmap JSON có kiểm tra, màn cuộn khóa theo nhịp, nhạc tạm là tiếng click.

`Judge` (`src/rhythm/Judge.ts`) chấm Tuyệt kỹ/Tốt/Trượt, đòn giữ, nhảy, phản đòn (kích hoạt/huỷ `onMiss`), kết liễu, Khí thế, combo, thua sau 3 lần Trượt, xếp hạng Thần/Kiện/Dũng/Tập (ngưỡng hạng là đề xuất, chưa có trong GDD). Có test Vitest; mọi hằng số chỉnh được trong bảng debug.

Bước tiếp theo: hiệu chỉnh độ trễ (Calibration), phát lại (replay) và bot tự chơi, Tâm pháp, tay cầm, nhạc thật thay tiếng click, đồ hoạ "thong manh".

## Git (nên làm)

```powershell
git init
git lfs install
git add .
git commit -m "Khung dự án Kiếm Phách"
```
