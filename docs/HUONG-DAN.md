# Hướng dẫn Kiếm Phách

Tài liệu này dành cho người chạy, chơi thử và phát triển game. Nó mô tả đúng những gì code hiện có (phiên bản 0.1.0). Phần nào chưa làm được ghi rõ là **chưa có**.

---

## 1. Cài đặt lần đầu (Windows)

1. Cài **Node.js 22 LTS** từ https://nodejs.org (bản 20 trở lên cũng được).
2. Cài **Git for Windows** từ https://git-scm.com.
3. Mở PowerShell rồi chạy:

```powershell
git clone https://github.com/YellowDuckcument/kiem-phach.git
cd kiem-phach
npm install
```

Nếu đã có sẵn thư mục `D:\3D_App\game` thì chỉ cần `cd D:\3D_App\game` rồi chạy `npm install`.

---

## 2. Chạy game

```powershell
npm run dev
```

Mở http://localhost:5173 rồi **bấm nút trên màn hình** để bắt đầu (trình duyệt chỉ cho phát âm thanh sau một cú bấm). Game tự tải lại mỗi khi bạn sửa code.

Hiện có một màn thử là `public/levels/demo.json`, chạy ở 100 BPM. Nhạc là tiếng click tạm, phách mạnh rơi vào đầu mỗi ô nhịp. Màn gồm 3 trận: Lính giáo, Đại đao, rồi **BOSS Tướng giặc** (khoảng nhịp 42–75).

---

## 3. Cách chơi

Phách đi bộ từ trái sang phải. **Gặp địch thì Phách dừng lại**, cảnh đứng yên trong suốt trận. Địch chờ ở phía trước, **gồng sức** (thân sáng dần, kiếm giơ cao) rồi **lao vào chém đúng nhịp**. Bạn bấm đúng lúc lưỡi kiếm chạm để đỡ. Đánh xong một đòn, địch lùi về rồi lao vào lần nữa. Hết trận, Phách đi tiếp tới trận sau.

**Vòng tín hiệu:** trước mỗi đòn, một vòng tròn co dần về quanh Phách và chạm vòng mờ cố định đúng vào nhịp phải bấm. Màu cho biết phím:
- **trắng:** J (chém hoặc giữ);
- **đỏ:** Space (nhảy, khi địch quét sóng sát đất);
- **vàng:** K (phản đòn hoặc kết liễu).

### Phím

| Phím | Hành động | Dùng cho đòn |
| --- | --- | --- |
| **J** | Chém / đỡ | Vòng trắng (`strike`). Đòn giữ (`hold`): địch ghì kiếm vào, giữ J đến hết đòn |
| **Space** | Nhảy | Vòng đỏ: địch cúi xuống và quét sóng đỏ sát đất (`jump`), là đòn không đỡ được |
| **K** | Phản đòn / kết liễu | Vòng vàng (`counter`, `finisher`) |
| **R** | Chơi lại ngay | — |
| **`** (phím dưới Esc) | Bật/tắt bảng debug | — |

Phím **L** (Tâm pháp) đã được gán nhưng **chưa có** chức năng. Tay cầm **chưa có**.

### Chấm điểm

| Kết quả | Độ lệch so với nhịp | Hiệu quả |
| --- | --- | --- |
| **Tuyệt kỹ** | trong ±40 ms | +2 Khí thế cho địch, tiếng "keng" cao, Phách lóe sáng |
| **Tốt** | trong ±90 ms | +1 Khí thế |
| **Trượt** | ngoài ±90 ms hoặc không bấm | mất combo, tiếng trầm |

- Độ lệch tính theo âm thanh **bạn nghe thấy**, không theo khung hình, nên máy giật hình cũng không làm chấm sai.
- Bấm khi không có đòn nào ("bấm hụt") thì mặc định không bị phạt.
- **Trượt 3 lần liên tiếp là thua.** Bấm R để chơi lại ngay.

### Các loại đòn

- **Đòn giữ:** bấm J đúng nhịp rồi giữ. Thả J sớm thì đứt đòn, tính là Trượt. Khí thế chỉ được cộng khi giữ trọn.
- **Nhảy:** chấm giống chém nhưng không cộng Khí thế.
- **Phản đòn:** nằm trên nhịp **im lặng** ngay sau đoạn địch gồng sức. Trúng thì địch thường vỡ thế ngay (boss mất một nấc thế), đồng thời đòn mạnh dự phòng bị hủy. Trượt thì đòn mạnh dự phòng xuất hiện (trong màn demo là một cú nhảy ở nhịp 33).
- **Kết liễu:** chỉ mở khi địch **đã vỡ thế**. Nếu địch chưa vỡ thế, đòn này bị bỏ qua và không tính là Trượt.

### Boss

Boss to hơn, màu chàm, có **thanh thế 20, chia 2 nấc**. Trận boss gồm: chém, đòn giữ, quét sóng, chuỗi chém nhanh, rồi **2 lần phản đòn** (nhịp 58 và 70, mỗi lần sau một đoạn boss gồng sức), cuối cùng là kết liễu ở nhịp 74.
- Mỗi lần phản đòn trúng, boss mất trọn một nấc thế.
- Chơi tốt (nhiều Tuyệt kỹ) thì boss vỡ thế ngay ở lần phản đòn thứ nhất. Toàn Tốt thì cần cả hai lần.
- Không phá được thế thì không kết liễu được: boss bỏ chạy và bạn vẫn qua màn.

### Khí thế và xếp hạng

- Mỗi địch có thanh Khí thế (ví dụ `e1 3/6`). Đầy thanh thì địch **vỡ thế**, kèm tiếng báo cao.
- Hết màn sẽ hiện hạng, dựa trên tỉ lệ Tuyệt kỹ:

| Hạng | Điều kiện |
| --- | --- |
| **Thần** | ≥ 90 % Tuyệt kỹ và không Trượt lần nào |
| **Kiện** | ≥ 70 % |
| **Dũng** | ≥ 40 % |
| **Tập** | qua màn |

> Ngưỡng hạng là **đề xuất**, chưa chốt trong GDD.

### Phản hồi khi bấm

- **J:** Phách vung kiếm.
- **Space:** Phách nhảy lên.
- **K:** vung kiếm kèm vòng sáng vàng.

Các động tác này chạy cả khi bấm hụt.

Kết quả hiện thành chữ lớn giữa màn hình: *Tuyệt kỹ*, *Tốt*, *Trượt*, *Trúng đòn!* (trượt cú nhảy), *Đứt đòn!*, *Phản đòn!*, *Vỡ thế!*, *Kết liễu!*. Khi Trượt, Phách lóe đỏ và bị đẩy lùi. Khi địch vỡ thế, nó chuyển đỏ và nghiêng người, báo rằng có thể kết liễu. Kết liễu trúng thì Phách lao tới và địch ngã xuống. Địch còn sống khi hết trận thì bỏ chạy.

### HUD góc màn hình

Gồm:
- phách hiện tại, BPM, ô nhịp;
- kết quả lần bấm gần nhất kèm số ms (số âm là bấm sớm, số dương là bấm muộn);
- combo; số Tuyệt kỹ/Tốt/Trượt;
- Khí thế từng địch;
- dòng **Tiếp theo**: phím cần bấm cho đòn kế tiếp và còn bao nhiêu phách nữa.

---

## 4. Bảng debug (phím `)

Bảng này hiện sẵn khi chạy `npm run dev` và ẩn trong bản build. Mọi thay đổi có hiệu lực ngay, không cần tải lại trang.

| Nhóm | Mục | Ý nghĩa |
| --- | --- | --- |
| Hiệu chỉnh (ms) | audio offset | Bạn hay bấm muộn bao nhiêu ms so với tiếng nghe (dùng khi tai nghe Bluetooth bị trễ) |
| | visual offset | Hình vẽ đi trước bao nhiêu ms (dùng khi màn hình/TV bị trễ) |
| Chấm điểm | Tuyệt kỹ ± ms, Tốt ± ms | Cửa sổ chấm |
| | Khí thế Tuyệt kỹ / Tốt | Lượng Khí thế cộng mỗi lần trúng |
| | Thua sau N Trượt | Mặc định 3 |
| | Phạt bấm hụt | Bật thì bấm hụt cũng tính là Trượt |
| | Ngưỡng hạng (đề xuất) | Thần / Kiện / Dũng |
| Camera | lead | Camera nhìn trước Phách bao xa |
| Động tác (tạm) | thời gian / độ cao nhảy, tốc độ vung kiếm, lùi khi trúng đòn | Chỉ ảnh hưởng hình, không ảnh hưởng chấm điểm |
| Giao chiến (hình) | bước đi / phách, khoảng cách địch, thời gian lao vào / lùi về, sóng quét, cỡ vòng tín hiệu | Chỉ ảnh hưởng hình, không ảnh hưởng chấm điểm |

**Mẹo hiệu chỉnh:** bấm J theo tiếng click vài lần rồi nhìn số ms trên HUD. Nếu số luôn dương khoảng +60 ms thì đặt *audio offset* = 60. Màn hiệu chỉnh tự động **chưa có**.

Giá trị chỉnh trong bảng **không được lưu**. Khi đã chốt được số, sửa trong `src/rhythm/constants.ts`.

---

## 5. Làm màn chơi (beatmap)

Mỗi màn là một file JSON trong `public/levels/`. Vị trí tính bằng **phách**, không tính bằng giây (0.5 là nửa phách). Mẫu đầy đủ xem ở `public/levels/demo.json`. Đặc tả chi tiết ở `.claude/skills/kiem-phach-rhythm/references/beatmap-schema.md`.

```jsonc
{
  "version": 1,
  "id": "demo",
  "title": "Thử nhịp",
  "chapter": 1,
  "difficulty": "thuong",                 // thuong | kho | ma-dao
  "audio": {
    "stems": {},                          // nhạc thật: CHƯA phát, game đang dùng tiếng click
    "offsetSec": 0,                       // giây từ đầu file nhạc tới phách 0
    "beatsPerBar": 4,
    "tempo": [{ "beat": 0, "bpm": 100 }]  // thêm điểm để đổi BPM giữa bài
  },
  "enemies": [
    // spawnBeat = lúc Phách dừng lại gặp địch. Trận kéo dài tới 1 phách sau đòn cuối của địch đó.
    // postureSegments > 1 thì là boss (to hơn, thế chia nấc).
    { "id": "e1", "kind": "linh-giao", "spawnBeat": 6, "posture": 6 },
    { "id": "boss", "kind": "dai-dao", "spawnBeat": 26, "posture": 6, "postureSegments": 3 }
  ],
  "notes": [
    { "id": "n1", "beat": 8,  "type": "strike", "enemy": "e1" },
    { "id": "n2", "beat": 16, "type": "hold", "lengthBeats": 2, "enemy": "e1" },
    { "id": "n3", "beat": 20, "type": "jump", "enemy": "e1" },
    { "id": "n4", "beat": 32, "type": "counter", "enemy": "boss",
      "onMiss": [{ "id": "n4m", "beat": 33, "type": "jump", "enemy": "boss" }] },
    { "id": "n5", "beat": 36, "type": "finisher", "enemy": "boss" }
  ],
  "events": [
    { "beat": 30, "type": "buildup", "enemy": "boss", "lengthBeats": 2 },
    { "beat": 32, "type": "silence", "lengthBeats": 1 }
  ]
}
```

Khi tải màn, game tự kiểm tra các lỗi sau và báo ngay trên màn hình:

- sai kiểu dữ liệu hoặc thiếu trường;
- `enemy` không có trong bảng `enemies`;
- đòn `hold` thiếu `lengthBeats`;
- trùng `id`;
- đòn trong `onMiss` không nằm sau đòn cha;
- đòn `counter` không nằm trên một sự kiện `silence`.

Muốn chơi màn khác thì hiện phải sửa đường dẫn `./levels/demo.json` trong `src/main.ts`. Menu chọn màn và trình soạn beatmap **chưa có**.

---

## 6. Lệnh cho người phát triển

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy thử tại http://localhost:5173 |
| `npm test` | Chạy toàn bộ test (Vitest) |
| `npm run test:watch` | Chạy lại test mỗi khi lưu file |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run build` | Build bản phát hành vào `dist/` |
| `npm run preview` | Chạy thử bản trong `dist/` |
| `npm run package:itch` | Build, kiểm tra giới hạn của itch.io rồi nén thành `release/kiem-phach-web.zip` |

### Cấu trúc code

```
src/
  audio/    AudioEngine (phát nhạc, SFX), SongClock (nguồn thời gian duy nhất)
  rhythm/   constants.ts (mọi con số chỉnh được), TempoMap, Beatmap, Judge (chấm điểm)
  combat/   Course: đi bộ / dừng lại theo trận, tính hoàn toàn từ phách
  input/    Bàn phím -> sự kiện có dấu thời gian
  render/   Stage: cảnh 2.5D tạm, địch gồng sức và lao vào chém theo nhịp, vòng tín hiệu
  core/     EventBus
  debug/    Bảng lil-gui
  main.ts   Nối các phần lại: input -> Judge -> sự kiện -> âm thanh/hình/HUD
tests/      Test Vitest
```

### Quy tắc khi sửa code

- Thời gian nhịp chỉ lấy từ `SongClock` (Web Audio). Không dùng `setTimeout`, không cộng dồn `dt` từ khung hình.
- Cửa sổ chấm và mọi con số chỉnh được phải nằm trong `src/rhythm/constants.ts` và có mặt trong bảng debug.
- `Judge` không được đụng tới DOM, âm thanh hay hình vẽ. Nó chỉ phát sự kiện (`NoteJudged`, `HoldBroken`, `CounterSuccess`, `PostureBroken`, `RunFailed`…), các phần khác tự lắng nghe.
- Mỗi lần sửa `Judge` phải kèm test trong `tests/Judge.test.ts`.
- Mục tiêu hiệu năng: 60 fps trên Steam Deck.

Quy tắc đầy đủ xem ở `CLAUDE.md` và `.claude/skills/`.

---

## 7. Lưu và đẩy code lên GitHub

```powershell
git add -A
git commit -m "Mô tả ngắn thay đổi"
git push
```

Repo: https://github.com/YellowDuckcument/kiem-phach (private).

---

## 8. Đăng lên itch.io

1. Chạy `npm run package:itch`.
2. Trên itch.io, tạo trang game, chọn *Kind of project: HTML*, rồi tải lên file `release/kiem-phach-web.zip`.
3. Tích ô *This file will be played in the browser*.

Hướng dẫn tải lên tự động bằng butler có trong skill `itch-publish`.

---

## 9. Tiến độ

**Đã có:** đi bộ / dừng lại theo trận, địch lao vào chém đúng nhịp, vòng tín hiệu, boss 2 nấc thế, đồng hồ nhịp theo âm thanh, bắt phím đúng thời điểm, beatmap có kiểm tra lỗi, đổi BPM, bộ chấm điểm đầy đủ (chém, giữ, nhảy, phản đòn, kết liễu, Khí thế, combo, thua, xếp hạng), bảng debug, cảnh 2.5D tạm.

**Chưa có:** màn hiệu chỉnh độ trễ tự động, replay và bot tự chơi, nhạc thật, tay cầm, Tâm pháp, đồ họa "thong manh" (bóng đen, gợn mực), nhân vật, menu, lưu hiệu chỉnh, trình soạn beatmap, bản Steam.
