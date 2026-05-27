import fs from 'node:fs';
import path from 'node:path';

import { assertFile, fail, readJson } from './util.mjs';

/**
 * Contract check aligned with recipe-viewer/scripts/validate-bundle.mjs.
 * @param {string} bundleRoot absolute path to EMI bundle root
 * @returns {{ bundle: object, recipeCount: number, languages: string[] }}
 */
export function validateBundle(bundleRoot) {
  const root = path.resolve(bundleRoot);
  if (!root || !fs.existsSync(root)) {
    fail(`bundle root does not exist: ${root || '<unset>'}`);
  }

  const bundle = readJson(path.join(root, 'bundle.json'));
  if (bundle.schema !== 1) fail(`bundle.schema expected 1, got ${bundle.schema}`);
  if (!Array.isArray(bundle.languages) || bundle.languages.length === 0) {
    fail('bundle.languages must be a non-empty array');
  }
  if (!bundle.missingIconId || typeof bundle.missingIconId !== 'string') {
    fail('bundle.json missing required field: missingIconId');
  }

  const recipeIndex = readJson(path.join(root, 'recipes/index.json'));
  const recipes = recipeIndex.recipes;
  if (!recipes || typeof recipes !== 'object') fail('recipes/index.json missing recipes map');

  const recipeIds = Object.keys(recipes);
  if (recipeIds.length === 0) fail('recipes/index.json has zero recipes');

  for (const id of recipeIds) {
    const layout = recipes[id]?.layout;
    if (!layout) fail(`recipes/index.json entry missing layout: ${id}`);
    if (layout.startsWith('emi/')) {
      fail(`layout path must be bundle-relative (recipes/layouts/...), not export-root path: ${id} -> ${layout}`);
    }
    if (!layout.startsWith('recipes/layouts/')) {
      fail(`unexpected layout path for ${id}: ${layout}`);
    }
    assertFile(root, layout);
  }

  assertFile(root, 'textures/manifest.json');
  assertFile(root, 'icons/index.json');
  assertFile(root, 'icons/icons.css');
  assertFile(root, 'tags/members.json');
  assertFile(root, `lang/${bundle.defaultLanguage || 'en_us'}.json`);
  assertFile(root, 'items/index.json');

  const icons = readJson(path.join(root, 'icons/index.json'));
  if (!icons.items?.[bundle.missingIconId]) {
    fail(`icons/index.json missing missingIconId entry: ${bundle.missingIconId}`);
  }

  if (bundle.recipeCount != null && bundle.recipeCount !== recipeIds.length) {
    fail(`bundle.recipeCount=${bundle.recipeCount} but index has ${recipeIds.length} recipes`);
  }

  return {
    bundle,
    recipeCount: recipeIds.length,
    languages: bundle.languages,
    missingIconId: bundle.missingIconId,
    root,
  };
}

export function printValidationOk(result) {
  console.log(`OK: ${result.root}`);
  console.log(`  recipes: ${result.recipeCount}`);
  console.log(`  languages: ${result.languages.length}`);
  console.log(`  missingIconId: ${result.missingIconId}`);
}
