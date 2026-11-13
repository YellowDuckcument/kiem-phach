import GUI from 'lil-gui';
import type { SongClock } from '../audio/SongClock';
import { CAMERA } from '../render/Stage';
import { KHI_THE, RANK, RULES, WINDOW } from '../rhythm/constants';

/** lil-gui panel for live tuning. Toggle with the ` key. Hidden by default in release builds. */
export function createDebugPanel(clock: SongClock): GUI {
  const gui = new GUI({ title: 'Kiếm Phách — debug' });
  const cal = gui.addFolder('Hiệu chỉnh (ms)');
  const proxy = {
    audioMs: clock.calibration.audioOffsetSec * 1000,
    visualMs: clock.calibration.visualOffsetSec * 1000,
  };
  cal.add(proxy, 'audioMs', -200, 200, 1).name('audio offset').onChange((v: number) => (clock.calibration.audioOffsetSec = v / 1000));
  cal.add(proxy, 'visualMs', -200, 200, 1).name('visual offset').onChange((v: number) => (clock.calibration.visualOffsetSec = v / 1000));
  const judge = gui.addFolder('Chấm điểm');
  const win = { perfectMs: WINDOW.perfect * 1000, goodMs: WINDOW.good * 1000 };
  judge.add(win, 'perfectMs', 10, 120, 1).name('Tuyệt kỹ ± ms').onChange((v: number) => (WINDOW.perfect = v / 1000));
  judge.add(win, 'goodMs', 20, 200, 1).name('Tốt ± ms').onChange((v: number) => (WINDOW.good = v / 1000));
  judge.add(KHI_THE, 'perfect', 0, 5, 1).name('Khí thế Tuyệt kỹ');
  judge.add(KHI_THE, 'good', 0, 5, 1).name('Khí thế Tốt');
  judge.add(RULES, 'failAfterMisses', 1, 10, 1).name('Thua sau N Trượt');
  judge.add(RULES, 'ghostPressPenalty').name('Phạt bấm hụt');
  const rank = judge.addFolder('Ngưỡng hạng (đề xuất)');
  rank.add(RANK, 'than', 0, 1, 0.01).name('Thần');
  rank.add(RANK, 'kien', 0, 1, 0.01).name('Kiện');
  rank.add(RANK, 'dung', 0, 1, 0.01).name('Dũng');
  rank.close();
  const cam = gui.addFolder('Camera');
  cam.add(CAMERA, 'lead', 0, 8, 0.1);
  if (!import.meta.env.DEV) gui.hide();
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') gui.show(gui._hidden);
  });
  return gui;
}
