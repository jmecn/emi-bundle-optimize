import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { optimizeBundle } from '../src/optimize.mjs';
import { convertIconAtlasesToWebp } from '../src/webp-icons.mjs';

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/minimal-bundle',
);

test('convertIconAtlasesToWebp rewrites css and index', async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-webp-'));
  const iconsDir = path.join(work, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  const pngPath = path.join(iconsDir, 'atlas-000.png');
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toFile(pngPath);

  fs.writeFileSync(
    path.join(iconsDir, 'icons.css'),
    ".icon-atlas { background-image: url('atlas-000.png'); }\n",
    'utf8',
  );
  fs.writeFileSync(
    path.join(iconsDir, 'index.json'),
    `${JSON.stringify({
      schema: 1,
      cellSize: 32,
      pages: [{ file: 'atlas-000.png', width: 32, height: 32 }],
      items: {},
    })}\n`,
    'utf8',
  );

  const result = await convertIconAtlasesToWebp(iconsDir, { quality: 90 });
  assert.equal(result.converted.length, 1);
  assert.ok(fs.existsSync(path.join(iconsDir, 'atlas-000.webp')));
  assert.equal(fs.existsSync(pngPath), false);

  const css = fs.readFileSync(path.join(iconsDir, 'icons.css'), 'utf8');
  assert.match(css, /atlas-000\.webp/);

  const index = JSON.parse(fs.readFileSync(path.join(iconsDir, 'index.json'), 'utf8'));
  assert.equal(index.pages[0].file, 'atlas-000.webp');

  fs.rmSync(work, { recursive: true, force: true });
});

test('optimizeBundle converts atlas when fixture has png', async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-opt-webp-'));
  const outDir = path.join(work, 'out');
  const iconsDir = path.join(work, 'in', 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.cpSync(fixtureRoot, path.join(work, 'in'), { recursive: true });

  await sharp({
    create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } },
  })
    .png()
    .toFile(path.join(iconsDir, 'atlas-000.png'));

  fs.writeFileSync(
    path.join(iconsDir, 'icons.css'),
    "/* test */\n.test { background-image: url('atlas-000.png'); }\n",
    'utf8',
  );
  const indexPath = path.join(iconsDir, 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  index.pages = [{ file: 'atlas-000.png', width: 16, height: 16 }];
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  const { report } = await optimizeBundle({
    inDir: path.join(work, 'in'),
    outDir,
    webp: true,
  });

  assert.equal(report.phase, '2b-v2');
  assert.ok(fs.existsSync(path.join(outDir, 'icons/atlas-000.webp')));
  assert.equal(fs.existsSync(path.join(outDir, 'icons/atlas-000.png')), false);

  fs.rmSync(work, { recursive: true, force: true });
});
