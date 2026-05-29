import { validateBundleRoot } from 'emi-recipe-renderer/validate';

import { BundleOptimizeError } from './util.mjs';

/**
 * JSON Schema validation via emi-recipe-renderer (bundle, route shards, layout packs).
 * @param {string} bundleRoot absolute path to EMI bundle root
 * @returns {{ bundle: object, recipeCount: number, languages: string[], missingIconId: string, root: string }}
 */
export function validateBundle(bundleRoot) {
  let result;
  try {
    result = validateBundleRoot(bundleRoot);
  } catch (err) {
    throw new BundleOptimizeError(err.message || String(err));
  }
  return {
    bundle: result.bundle,
    recipeCount: result.recipeIds.length,
    languages: result.bundle.languages,
    missingIconId: result.bundle.missingIconId,
    root: result.root,
  };
}

export function printValidationOk(result) {
  console.log(`OK: ${result.root}`);
  console.log(`  recipes: ${result.recipeCount}`);
  console.log(`  languages: ${result.languages.length}`);
  console.log(`  missingIconId: ${result.missingIconId}`);
}
