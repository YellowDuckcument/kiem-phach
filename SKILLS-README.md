# Bộ skill cho Kiếm Phách

Các skill trong `.claude/skills/` được chọn lọc từ 3 bộ mã nguồn mở, cho dự án game nhịp điệu 2.5D **Kiếm Phách** (three.js + Web Audio, đóng gói Electron lên Steam).

Claude Code tự đọc thư mục `.claude/skills/` khi bạn mở Claude Code tại thư mục gốc `D:\3D_App\game`. Skill được nạp tự động khi yêu cầu của bạn khớp với mô tả của nó, hoặc gọi trực tiếp bằng `/tên-skill`.

## 1. Three.js (15 skill) — từ OpenAEC-Foundation/Three.js-Claude-Skill-Package (MIT)

| Skill | Dùng cho Kiếm Phách |
| --- | --- |
| threejs-core-scene-graph | Cây đối tượng, lớp cảnh, sương mù |
| threejs-core-renderer | Renderer, tone mapping, quản lý màu, render target |
| threejs-core-math | Vector, ma trận, quaternion cho camera và chuyển động |
| threejs-syntax-geometries | Hình học, InstancedMesh cho cây cỏ, lính lặp lại |
| threejs-syntax-materials | Vật liệu, texture, color space |
| threejs-syntax-shaders | Shader sơn mài, viền mực, bóng đen thong manh |
| threejs-syntax-loaders | Đọc glTF từ Blender, Draco, KTX2 |
| threejs-impl-lighting | Ánh sáng đèn lồng, lửa |
| threejs-impl-shadows | Bóng đổ |
| threejs-impl-animation | Hoạt ảnh xương từ glTF, chuyển mượt giữa hoạt ảnh |
| threejs-impl-post-processing | Hậu kỳ: mờ cảnh, sóng mực, bloom (pmndrs/postprocessing) |
| threejs-errors-performance | Rò rỉ bộ nhớ, giảm draw call (Steam Deck) |
| threejs-errors-rendering | Màn hình đen, sai màu, lỗi bóng |
| threejs-agents-scene-builder | Cây quyết định dựng một cảnh hoàn chỉnh |
| threejs-agents-model-optimizer | Dây chuyền tối ưu glTF (Draco, KTX2, LOD) |

**Bỏ qua:** React Three Fiber, Drei (không dùng React), IFC, WebXR, vật lý (game không cần), WebGPU (còn thử nghiệm), raycaster và controls (không dùng chuột chọn vật thể), audio (chỉ là âm thanh 3D, không phải đồng hồ nhịp).

## 2. Chuyên môn & quy trình (14 skill) — từ gamedev-skills/awesome-gamedev-agent-skills (Apache-2.0)

| Skill | Dùng cho Kiếm Phách |
| --- | --- |
| game-feel | Rung màn hình, hit-stop, easing: cảm giác "keng" khi đỡ Tuyệt kỹ |
| audio-design | Bus âm thanh, nhạc thích ứng, ducking |
| shader-programming | Khái niệm shader chung |
| camera-systems | Camera cuộn ngang, rung camera |
| input-systems | Bàn phím, tay cầm, đổi phím, bộ đệm đầu vào |
| game-ui-ux | HUD, menu, Thư viện hướng dẫn |
| level-design | Bố cục màn, nhịp độ, đường cong độ khó |
| performance-optimization | Tối ưu hiệu năng chung |
| save-systems | Lưu tiến trình, lưu cloud |
| create-game-assets | Đồ họa AI nhất quán, ghi giấy phép, khai báo AI cho Steam |
| prototype-fast | Làm prototype nhanh (Cổng 1) |
| game-docs | Giữ GDD khớp với code |
| steam-publish | Steamworks, depot, trang cửa hàng, checklist phát hành |
| itch-publish | Đăng bản web lên itch.io |

**Bỏ qua:** bộ điều phối (router) vì nó chọn đúng một engine và có thể đoán sai với three.js; 3 skill three.js cơ bản (trùng với bộ OpenAEC); mọi skill Godot, Unity, Unreal; các thể loại không liên quan.

Một số skill nhắc tới skill anh em không có ở đây (ví dụ `godot-animation`, `platformer`). Đó chỉ là liên kết tham khảo, không ảnh hưởng.

## 3. Mẫu tài liệu (20 mẫu) — từ Donchitos/Claude-Code-Game-Studios (MIT)

Nằm ở `docs/templates/`: ADR, art bible, sound bible, đường cong độ khó, thiết kế màn, HUD, trụ cột game, hành trình người chơi, tài liệu kỹ thuật, kế hoạch sprint, mốc, báo cáo prototype và vertical slice, rủi ro, báo lỗi, chứng nhận Steam và itch.io, checklist ra mắt và phát hành, post-mortem.

**Không lấy skill của bộ này:** các skill của Game Studios phụ thuộc vào hook, script, file `project.yaml` và 49 agent của chính nó, nên tách lẻ sẽ không chạy. Bộ này cũng chỉ có agent cho Godot, Unity, Unreal.

## 4. Skill riêng của Kiếm Phách (2 skill, viết theo GDD)

| Skill | Nội dung |
| --- | --- |
| kiem-phach-rhythm | Đồng hồ Web Audio, thời điểm bấm, chấm Tuyệt kỹ/Tốt/Trượt, Khí thế, phản đòn, kết liễu, beatmap JSON, hiệu chỉnh độ trễ, 4 kỹ năng Tâm pháp (Thính phong làm chậm nhạc, cao độ trầm xuống), test và công cụ soạn beatmap |
| kiem-phach-style | Bố cục 2.5D, camera và lớp chiều sâu, quy ước Blender, nhân vật cắt mảnh kiểu rối nước (tự viết bộ xương, không dùng Spine), hiệu ứng thong manh, bảng màu sơn mài, kiểm tra độ dễ đọc, ngân sách hiệu năng Steam Deck |

Các con số chưa có trong GDD được ghi rõ là "proposal" trong skill: ngưỡng xếp hạng, cỡ thanh Tâm, phím cho kỹ năng thứ hai, mã màu hex, ngân sách hiệu năng.

## Chưa làm

- Skill đóng gói Electron + steamworks.js (để sau).

## Nguồn (bản đã tải, 12/11/2026)

- OpenAEC-Foundation/Three.js-Claude-Skill-Package @ 6c190f0
- gamedev-skills/awesome-gamedev-agent-skills @ c6ca6c4
- Donchitos/Claude-Code-Game-Studios @ abc0de7

Giấy phép gốc ở `THIRD_PARTY_LICENSES/`. Giữ nguyên các file này khi phân phối lại.
