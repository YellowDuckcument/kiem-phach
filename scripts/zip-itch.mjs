// Zips dist/ into release/kiem-phach-web.zip for upload to itch.io,
// after checking itch.io HTML5 limits.
import { createWriteStream, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import archiver from 'archiver';

const DIST = 'dist';
const LIMITS = { files: 1000, totalBytes: 500 * 1024 * 1024, fileBytes: 200 * 1024 * 1024, pathChars: 240 };

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else files.push({ path: relative(DIST, p).replaceAll('\\', '/'), size: s.size });
  }
};
walk(DIST);

const total = files.reduce((a, f) => a + f.size, 0);
const problems = [];
if (files.length > LIMITS.files) problems.push(`too many files: ${files.length} > ${LIMITS.files}`);
if (total > LIMITS.totalBytes) problems.push(`total size ${(total / 1e6).toFixed(1)} MB > 500 MB`);
for (const f of files) {
  if (f.size > LIMITS.fileBytes) problems.push(`file too large: ${f.path}`);
  if (f.path.length > LIMITS.pathChars) problems.push(`path too long: ${f.path}`);
}
if (problems.length) {
  console.error('itch.io limits exceeded:\n- ' + problems.join('\n- '));
  process.exit(1);
}

mkdirSync('release', { recursive: true });
const out = createWriteStream('release/kiem-phach-web.zip');
const zip = archiver('zip', { zlib: { level: 9 } });
zip.pipe(out);
zip.directory(DIST, false);
await zip.finalize();
out.on('close', () =>
  console.log(`release/kiem-phach-web.zip — ${files.length} files, ${(total / 1e6).toFixed(1)} MB unpacked. Upload it on itch.io as an HTML game.`),
);
