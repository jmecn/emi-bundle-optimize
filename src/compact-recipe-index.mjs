import fs from 'node:fs';
import path from 'node:path';

/**
 * Legacy recipe index shapes are no longer supported by protocol.
 * @returns {boolean} true if file was rewritten
 */
export function compactRecipeIndexIfNeeded(bundleRoot) {
  for (const rel of ['recipes/index.json', 'recipes/shards', 'recipes/layouts']) {
    if (fs.existsSync(path.join(bundleRoot, rel))) {
      throw new Error(
        `legacy recipe layout detected (${rel}); expected bundle.mods with recipes/routes/ and recipes/layout-packs/`,
      );
    }
  }
  return false;
}
