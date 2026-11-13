import GUI from 'lil-gui';
import type { SongClock } from '../audio/SongClock';
import { COURSE } from '../combat/Course';
import { ACT, ATTACK, CAMERA } from '../render/Stage';
import { RIG } from '../render/rig/PhachAnimator';
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
  const act = gui.addFolder('Động tác (tạm)');
  act.add(ACT, 'jumpSec', 0.1, 1, 0.01).name('thời gian nhảy (s)');
  act.add(ACT, 'jumpHeight', 0.2, 4, 0.1).name('độ cao nhảy');
  act.add(ACT, 'swingDecay', 1, 20, 0.5).name('tốc độ vung kiếm');
  act.add(ACT, 'knockback', 0, 3, 0.1).name('lùi khi trúng đòn');
  act.close();
  const fight = gui.addFolder('Giao chiến (hình)');
  fight.add(COURSE, 'walkUnits', 0.5, 10, 0.1).name('bước đi / phách');
  fight.add(COURSE, 'standoff', 2, 10, 0.1).name('khoảng cách địch');
  fight.add(ATTACK, 'dashBeats', 0.1, 1, 0.05).name('lao vào (phách)');
  fight.add(ATTACK, 'recoverBeats', 0.1, 1, 0.05).name('lùi về (phách)');
  fight.add(ATTACK, 'waveBeats', 0.2, 2, 0.05).name('sóng quét (phách)');
  fight.add(ATTACK, 'cueScale', 1.5, 6, 0.1).name('vòng tín hiệu');
  fight.close();
  const rig = gui.addFolder('Rig Phách');
  rig.add(RIG, 'scale', 0.4, 1.5, 0.05).name('kích thước');
  rig.add(RIG, 'strikeSec', 0.1, 0.8, 0.01).name('chém (s)');
  rig.add(RIG, 'strikeSnap', 0.1, 0.8, 0.05).name('phần vung xuống');
  rig.add(RIG, 'counterSec', 0.1, 0.8, 0.01).name('phản đòn (s)');
  rig.add(RIG, 'beatsPerStep', 0.25, 2, 0.25).name('phách mỗi bước');
  rig.add(RIG, 'stance', 0.5, 0.8, 0.01).name('thời gian chân chạm đất');
  rig.add(RIG, 'footLift', 0, 0.4, 0.01).name('nhấc chân');
  rig.add(RIG, 'walkHeight', 0.85, 1, 0.01).name('độ cao hông khi đi');
  rig.add(RIG, 'toeOff', 0, 1, 0.05).name('nhón gót khi đẩy');
  rig.add(RIG, 'heelStrike', 0, 0.8, 0.05).name('hếch mũi khi chạm');
  rig.add(RIG, 'lagHz', 0.5, 10, 0.1).name('độ trễ (Hz)');
  rig.add(RIG, 'lagDamp', 0.1, 1.5, 0.05).name('độ giảm chấn');
  rig.add(RIG, 'breathe', 0, 0.2, 0.01).name('thở theo nhịp');
  rig.add(RIG, 'scarfFlutter', 0, 1, 0.05).name('khăn bay');
  rig.close();
  if (!import.meta.env.DEV) gui.hide();
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') gui.show(gui._hidden);
  });
  return gui;
}
