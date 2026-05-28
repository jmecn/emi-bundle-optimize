import fs from 'node:fs';
import path from 'node:path';

import { readJson } from './util.mjs';

/**
 * Legacy recipe index shapes are no longer supported by protocol.
 * @returns {boolean} true if file was rewritten
 */
export function compactRecipeIndexIfNeeded(bundleRoot) {
  const indexPath = path.join(bundleRoot, 'recipes/index.json');
  if (!fs.existsSync(indexPath)) return false;

  const index = readJson(indexPath);
  if (Array.isArray(index.namespaces)) return false;
  if (Array.isArray(index.recipeIds) || (index.recipes && typeof index.recipes === 'object')) {
    throw new Error(
      'legacy recipe index detected; expected recipes/index.json with namespaces + recipes/shards/<namespace>.json',
    );
  }
  return false;
}
