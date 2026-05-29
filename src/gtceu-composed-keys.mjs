/**
 * Keep in sync with emi-recipe-renderer/src/gtceu-translate.js (collect* helpers).
 */

/** Mod id for GregTech CEu composed names (tagprefix + material). */
export const GTCEU_NAMESPACE = 'gtceu';

const GTCEU_TAG_PREFIX_PATTERN_OVERRIDES = {
  raw: 'raw_%s',
  raw_ore_block: 'raw_%s_block',
  refined_ore: 'refined_%s_ore',
  purified_ore: 'purified_%s_ore',
  crushed_ore: 'crushed_%s_ore',
  hot_ingot: 'hot_%s_ingot',
  chipped_gem: 'chipped_%s_gem',
  flawed_gem: 'flawed_%s_gem',
  flawless_gem: 'flawless_%s_gem',
  exquisite_gem: 'exquisite_%s_gem',
  small_dust: 'small_%s_dust',
  tiny_dust: 'tiny_%s_dust',
  impure_dust: 'impure_%s_dust',
  pure_dust: 'pure_%s_dust',
  dense_plate: 'dense_%s_plate',
  double_plate: 'double_%s_plate',
  long_rod: 'long_%s_rod',
  small_spring: 'small_%s_spring',
  fine_wire: 'fine_%s_wire',
  small_gear: 'small_%s_gear',
};

function extractMaterialFromIdPattern(path, pattern) {
  if (!path || !pattern || !pattern.includes('%s')) return null;
  if (pattern.startsWith('%s_')) {
    const suffix = pattern.slice(2);
    if (path.endsWith(suffix)) {
      const material = path.slice(0, path.length - suffix.length);
      return material || null;
    }
    return null;
  }
  if (pattern.endsWith('_%s')) {
    const prefix = pattern.slice(0, -2);
    if (path.startsWith(prefix)) {
      const material = path.slice(prefix.length);
      return material || null;
    }
    return null;
  }
  const idx = pattern.indexOf('%s');
  const before = pattern.slice(0, idx);
  const after = pattern.slice(idx + 2);
  if (path.startsWith(before) && path.endsWith(after)) {
    const material = path.slice(before.length, path.length - after.length);
    return material || null;
  }
  return null;
}

function materialKey(namespace, materialPath) {
  return `material.${namespace}.${materialPath}`;
}

export function isGtceuComposedNamespace(namespace) {
  return namespace === GTCEU_NAMESPACE;
}

/**
 * Scan lang tables once for tagprefix.* keys (avoid O(items × langKeys) during prune).
 */
export function buildGtceuPruneContext(langTables = []) {
  const suffixes = new Set(Object.keys(GTCEU_TAG_PREFIX_PATTERN_OVERRIDES));
  for (const langTable of langTables) {
    if (!langTable || typeof langTable !== 'object') continue;
    for (const key of Object.keys(langTable)) {
      if (!key.startsWith('tagprefix.')) continue;
      let rest = key.slice('tagprefix.'.length);
      if (rest.startsWith('polymer.')) rest = rest.slice('polymer.'.length);
      if (rest) suffixes.add(rest);
    }
  }
  return { suffixes };
}

export function collectComposedItemLangKeys(namespace, path, ctx) {
  const keys = new Set();
  if (!isGtceuComposedNamespace(namespace) || !path) return keys;
  const suffixes = ctx?.suffixes;
  if (!suffixes?.size) return keys;

  if (path.endsWith('_bucket')) {
    keys.add(`item.${namespace}.bucket`);
    keys.add(materialKey(namespace, path.slice(0, -'_bucket'.length)));
    return keys;
  }

  for (const langSuffix of suffixes) {
    const pattern = GTCEU_TAG_PREFIX_PATTERN_OVERRIDES[langSuffix] || `%s_${langSuffix}`;
    const materialPath = extractMaterialFromIdPattern(path, pattern);
    if (!materialPath) continue;
    keys.add(`tagprefix.${langSuffix}`);
    keys.add(`tagprefix.polymer.${langSuffix}`);
    keys.add(materialKey(namespace, materialPath));
    break;
  }

  return keys;
}

export function collectComposedFluidLangKeys(namespace, path) {
  const keys = new Set();
  if (!isGtceuComposedNamespace(namespace) || !path) return keys;
  keys.add(materialKey(namespace, path));
  return keys;
}

export function collectGtceuComposedLangKeys(kind, registryId, ctx) {
  const keys = new Set();
  const bare = String(registryId || '').trim();
  const colon = bare.indexOf(':');
  if (colon <= 0 || colon >= bare.length - 1) return keys;

  const namespace = bare.slice(0, colon);
  const path = bare.slice(colon + 1);
  if (!isGtceuComposedNamespace(namespace)) return keys;

  if (kind === 'fluid') {
    for (const key of collectComposedFluidLangKeys(namespace, path)) keys.add(key);
    return keys;
  }
  if (kind === 'item' || kind === 'block') {
    for (const key of collectComposedItemLangKeys(namespace, path, ctx)) {
      keys.add(key);
    }
  }
  return keys;
}
