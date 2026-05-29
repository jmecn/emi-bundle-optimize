import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { BundleOptimizeError } from '../src/util.mjs';
import { validateBundle } from '../src/validate.mjs';

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/minimal-bundle',
);

test('validateBundle accepts minimal fixture', () => {
  const result = validateBundle(fixtureRoot);
  assert.equal(result.recipeIds.length, 1);
  assert.equal(result.recipeIds[0], 'test:smoke');
  assert.equal(result.bundle.missingIconId, 'fieldguide:missing_icon');
});

test('validateBundle rejects missing root', () => {
  assert.throws(
    () => validateBundle(path.join(os.tmpdir(), 'emi-bundle-optimize-missing-' + Date.now())),
    BundleOptimizeError,
  );
});
