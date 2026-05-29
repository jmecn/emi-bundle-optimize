import { printValidationOk, validateBundleRoot } from 'emi-recipe-renderer/validate';

import { BundleOptimizeError } from './util.mjs';

export { printValidationOk };

export function validateBundle(bundleRoot) {
  try {
    return validateBundleRoot(bundleRoot);
  } catch (err) {
    throw new BundleOptimizeError(err.message || String(err));
  }
}
