import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { optimizeBundle } from '../src/optimize.mjs';

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/minimal-bundle',
);

test('optimizeBundle copies tree and stamps bundle.json', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-opt-out-'));
  try {
    const { report } = await optimizeBundle({ inDir: fixtureRoot, outDir, webp: false });
    assert.equal(report.profile, 'optimized');

    const bundle = JSON.parse(fs.readFileSync(path.join(outDir, 'bundle.json'), 'utf8'));
    assert.equal(bundle.profile, 'optimized');
    assert.match(bundle.optimizedBy, /^emi-bundle-optimize@/);
    assert.equal(bundle.optimizedFrom, path.resolve(fixtureRoot));
    assert.ok(bundle.optimizedAt);

    assert.ok(fs.existsSync(path.join(outDir, 'optimize-report.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'recipes/layout-packs/test/000-def456.json')));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('optimizeBundle dryRun writes no files', async () => {
  const outDir = path.join(os.tmpdir(), `emi-opt-dry-run-${Date.now()}`);
  const result = await optimizeBundle({
    inDir: fixtureRoot,
    outDir,
    dryRun: true,
    webp: true,
    webpQuality: 77,
  });
  assert.equal(result.report.dryRun, true);
  assert.equal(result.reportPath, null);
  assert.equal(result.report.webp.quality, 77);
  assert.equal(fs.existsSync(outDir), false);
  assert.equal(result.report.recipeCount, 1);
});

test('optimizeBundle pruneLang keeps only used keys', async () => {
  const tempIn = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-lang-prune-in-'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-lang-prune-out-'));
  try {
    fs.cpSync(fixtureRoot, tempIn, { recursive: true, dereference: true });
    const langPath = path.join(tempIn, 'lang/en_us.json');
    fs.writeFileSync(langPath, `${JSON.stringify({
      'item.test.smoke': 'Smoke Item',
      'item.test.unused': 'Unused Item',
      'tag.item.minecraft.logs': 'Logs',
      'text.unused': 'Unused',
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(tempIn, 'items/index.json'), `${JSON.stringify({
      schema: 1,
      test: ['smoke'],
    }, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(tempIn, 'tags/index.json'), `${JSON.stringify({
      schema: 1,
      items: ['minecraft:logs'],
      blocks: [],
      fluids: [],
    }, null, 2)}\n`, 'utf8');
    fs.mkdirSync(path.join(tempIn, 'items/test'), { recursive: true });
    fs.writeFileSync(path.join(tempIn, 'items/test/smoke.json'), '{}\n', 'utf8');
    fs.mkdirSync(path.join(tempIn, 'tags/minecraft/items'), { recursive: true });
    fs.writeFileSync(path.join(tempIn, 'tags/minecraft/items/logs.json'), '{}\n', 'utf8');

    const { report } = await optimizeBundle({
      inDir: tempIn,
      outDir,
      webp: false,
      pruneLang: true,
    });
    assert.equal(report.lang.enabled, true);
    assert.equal(report.lang.totalRemovedKeys, 2);
    const pruned = JSON.parse(fs.readFileSync(path.join(outDir, 'lang/en_us.json'), 'utf8'));
    assert.equal(pruned['item.test.smoke'], 'Smoke Item');
    assert.equal(pruned['tag.item.minecraft.logs'], 'Logs');
    assert.equal(pruned['item.test.unused'], undefined);
    assert.equal(pruned['text.unused'], undefined);
  } finally {
    fs.rmSync(tempIn, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
