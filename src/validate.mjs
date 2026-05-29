import fs from 'node:fs';
import path from 'node:path';

import { assertFile, fail, readJson } from './util.mjs';
import { readRecipeIds } from './recipe-index.mjs';

const LEGACY_PATHS = [
  'recipes/index.json',
  'recipes/shards',
  'recipes/layouts',
];

/**
 * Contract check aligned with EMI bundle protocol (routes + layout-packs).
 * @param {string} bundleRoot absolute path to EMI bundle root
 * @returns {{ bundle: object, recipeCount: number, languages: string[] }}
 */
export function validateBundle(bundleRoot) {
  const root = path.resolve(bundleRoot);
  if (!root || !fs.existsSync(root)) {
    fail(`bundle root does not exist: ${root || '<unset>'}`);
  }

  for (const rel of LEGACY_PATHS) {
    if (fs.existsSync(path.join(root, rel))) {
      fail(`legacy path must not exist: ${rel}`);
    }
  }

  const { bundle, recipeIds } = readRecipeIds(root);

  if (!Array.isArray(bundle.languages) || bundle.languages.length === 0) {
    fail('bundle.languages must be a non-empty array');
  }
  if (!bundle.languages.includes('en_us')) {
    fail('bundle.languages must include en_us');
  }
  if (!bundle.missingIconId || typeof bundle.missingIconId !== 'string') {
    fail('bundle.json missing required field: missingIconId');
  }

  assertFile(root, 'textures/manifest.json');
  assertFile(root, 'icons/index.json');
  const iconCssPath = path.join(root, 'icons/icons.css');
  if (!fs.existsSync(iconCssPath)) {
    const icons = readJson(path.join(root, 'icons/index.json'));
    const hasInlineAtlas = Object.values(icons?.items || {}).some((entry) => (
      entry
      && typeof entry === 'object'
      && Number.isInteger(entry.page)
      && Number.isFinite(entry.x)
      && Number.isFinite(entry.y)
    ));
    if (!hasInlineAtlas) {
      fail('icons/icons.css missing and icons/index.json has no inline atlas coordinates');
    }
  }
  const tagsIndexPath = path.join(root, 'tags/index.json');
  if (fs.existsSync(tagsIndexPath)) {
    const tagsIndex = readJson(tagsIndexPath);
    if (tagsIndex.schema !== 1) fail(`tags/index.json schema expected 1, got ${tagsIndex.schema}`);
    for (const type of ['items', 'blocks', 'fluids']) {
      const list = tagsIndex[type];
      if (list == null) continue;
      if (!Array.isArray(list)) {
        fail(`tags/index.json "${type}" must be array`);
      }
    }
  }
  const fallbackLang = bundle.languages.includes('en_us') ? 'en_us' : bundle.languages[0];
  assertFile(root, `lang/${fallbackLang}.json`);
  assertFile(root, 'items/index.json');

  const icons = readJson(path.join(root, 'icons/index.json'));
  if (!icons.items?.[bundle.missingIconId]) {
    fail(`icons/index.json missing missingIconId entry: ${bundle.missingIconId}`);
  }

  if (bundle.recipeCount != null && bundle.recipeCount !== recipeIds.length) {
    fail(`bundle.recipeCount=${bundle.recipeCount} but routes have ${recipeIds.length} recipes`);
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
