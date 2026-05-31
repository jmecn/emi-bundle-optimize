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

test('optimizeBundle --no-recipe-webp keeps recipe PNG', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-recipe-webp-skip-out-'));
  try {
    const { report } = await optimizeBundle({
      inDir: fixtureRoot,
      outDir,
      webp: true,
      recipeWebp: false,
      webpQuality: 90,
    });
    const bundle = JSON.parse(fs.readFileSync(path.join(outDir, 'bundle.json'), 'utf8'));
    assert.equal(bundle.recipeImageFormat, 'png');
    assert.ok(fs.existsSync(path.join(outDir, 'recipes/test/smoke.png')));
    assert.equal(fs.existsSync(path.join(outDir, 'recipes/test/smoke.webp')), false);
    assert.equal(report.recipeWebp?.skipped, true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('optimizeBundle sets recipeImageFormat webp and converts recipe PNG', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-recipe-webp-out-'));
  try {
    const { report } = await optimizeBundle({
      inDir: fixtureRoot,
      outDir,
      webp: true,
      webpQuality: 90,
    });
    const bundle = JSON.parse(fs.readFileSync(path.join(outDir, 'bundle.json'), 'utf8'));
    assert.equal(bundle.recipeImageFormat, 'webp');
    assert.ok(fs.existsSync(path.join(outDir, 'recipes/test/smoke.webp')));
    assert.equal(fs.existsSync(path.join(outDir, 'recipes/test/smoke.png')), false);
    assert.ok(report.recipeWebp?.converted?.length >= 1);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
