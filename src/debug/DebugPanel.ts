import GUI from 'lil-gui';
import type { SongClock } from '../audio/SongClock';
import { CAMERA } from '../render/Stage';

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
  const cam = gui.addFolder('Camera');
  cam.add(CAMERA, 'lead', 0, 8, 0.1);
  if (!import.meta.env.DEV) gui.hide();
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') gui.show(gui._hidden);
  });
  return gui;
}
