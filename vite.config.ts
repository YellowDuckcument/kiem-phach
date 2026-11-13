import { writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { defineConfig } from 'vitest/config';

// vitest ships its own copy of vite, so take the plugin type from vitest's defineConfig.
type Plugin = NonNullable<Parameters<typeof defineConfig>[0] extends infer C ? C extends { plugins?: (infer P)[] } ? P : never : never>;

/**
 * Dev only: lets /rig.html save edited joints. Accepts POST /__rig/save with
 * { path: "art/phach/phach.rig.json", rig, joints, poses? } and writes the rig JSON,
 * <name>.joints.json (hand-placed joints that scripts/art/build_rig.py keeps) and, if sent,
 * <name>.poses.json (pose angles rotated by hand, read by PhachAnimator).
 * Only files under public/art ending in .rig.json can be written.
 */
function rigSave(): Plugin {
  return {
    name: 'kp-rig-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__rig/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (c: Buffer) => (body += c.toString('utf8')));
        req.on('end', () => {
          try {
            const { path, rig, joints, poses } = JSON.parse(body) as {
              path: string;
              rig: unknown;
              joints: unknown;
              poses?: unknown;
            };
            const artRoot = resolve('public/art');
            const target = resolve('public', path.replace(/^\.?\//, ''));
            if (!target.startsWith(artRoot + sep) || !target.endsWith('.rig.json')) throw new Error('path not allowed');
            const write = (ext: string, data: unknown) =>
              writeFileSync(target.replace(/\.rig\.json$/, ext), JSON.stringify(data, null, 1) + '\n', 'utf8');
            write('.rig.json', rig);
            write('.joints.json', joints);
            if (poses) write('.poses.json', poses);
            res.end('ok');
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
      });
    },
  };
}

// itch.io serves the game from a sub-path: every URL must be relative.
export default defineConfig({
  base: './',
  plugins: [rigSave()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
