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

export { printValidationOk };
