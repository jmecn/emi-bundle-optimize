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

test('optimizeBundle copies tree and stamps bundle.json', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emi-opt-out-'));
  try {
    const { report } = optimizeBundle({ inDir: fixtureRoot, outDir });
    assert.equal(report.profile, 'optimized');

    const bundle = JSON.parse(fs.readFileSync(path.join(outDir, 'bundle.json'), 'utf8'));
    assert.equal(bundle.profile, 'optimized');
    assert.match(bundle.optimizedBy, /^emi-bundle-optimize@/);
    assert.equal(bundle.optimizedFrom, path.resolve(fixtureRoot));
    assert.ok(bundle.optimizedAt);

    assert.ok(fs.existsSync(path.join(outDir, 'optimize-report.json')));
    assert.ok(fs.existsSync(path.join(outDir, 'recipes/layouts/test-smoke.json')));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
