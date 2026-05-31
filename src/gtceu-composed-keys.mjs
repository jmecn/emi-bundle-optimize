/**
 * GTCEu lang closure for prune — re-exports {@code emi-recipe-renderer/gtceu-translate.js} (single source of truth).
 */

import {
  GTCEU_NAMESPACE,
  collectComposedFluidLangKeys,
  collectComposedItemLangKeys,
  isGtceuComposedNamespace,
  splitRegistryId,
} from 'emi-recipe-renderer/gtceu-translate.js';

export { GTCEU_NAMESPACE, isGtceuComposedNamespace };

/** Merge bundle lang tables for tagprefix pattern discovery (same as renderer {@link buildTagPrefixPatterns}). */
export function buildGtceuPruneContext(langTables = []) {
  const langTable = {};
  for (const table of langTables) {
    if (table && typeof table === 'object') {
      Object.assign(langTable, table);
    }
  }
  return { langTable };
}

/**
 * Lang keys required to render a GTCEu registry id (items, fluids, buckets).
 * @returns {Set<string>}
 */
export function collectGtceuComposedLangKeys(kind, registryId, ctx) {
  const keys = new Set();
  const { namespace, path } = splitRegistryId(registryId);
  if (!isGtceuComposedNamespace(namespace) || !path) {
    return keys;
  }

  const langTable = ctx?.langTable ?? {};
  if (kind === 'fluid') {
    for (const key of collectComposedFluidLangKeys(namespace, path, langTable)) {
      keys.add(key);
    }
    return keys;
  }
  if (kind === 'item' || kind === 'block') {
    for (const key of collectComposedItemLangKeys(namespace, path, langTable)) {
      keys.add(key);
    }
  }
  return keys;
}
