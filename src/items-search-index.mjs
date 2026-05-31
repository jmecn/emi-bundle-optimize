import fs from 'node:fs';
import path from 'node:path';

import { pinyin } from 'pinyin-pro';
import {
  createRegistryLabelResolver,
  FALLBACK_LOCALE,
  normalizeLocale,
} from 'emi-recipe-renderer/registry-label.mjs';

import { readBundleJson } from './layouts.mjs';
import { readJson, writeJson } from './util.mjs';

const ITEMS_SEARCH_DIR = 'items-search';
const ZH_LOCALE_RE = /^zh(_|$)/;

function stripMinecraftFormatting(text) {
  if (text == null || text === '') return '';
  return String(text).replace(/§./g, '');
}

function catalogIdFromIndexEntry(ns, itemPath) {
  if (itemPath.includes(':')) return itemPath;
  return `${ns}:${itemPath}`;
}

export function parseItemIdsFromIndex(bundleRoot) {
  const indexPath = path.join(bundleRoot, 'items/index.json');
  if (!fs.existsSync(indexPath)) return [];
  const index = readJson(indexPath);
  if (!index || typeof index !== 'object') return [];
  const ids = new Set();
  for (const [ns, paths] of Object.entries(index)) {
    if (ns === 'schema' || !Array.isArray(paths)) continue;
    for (const itemPath of paths) {
      if (typeof itemPath === 'string' && itemPath.length > 0) {
        ids.add(catalogIdFromIndexEntry(ns, itemPath));
      }
    }
  }
  return [...ids].sort();
}

function readLangTable(bundleRoot, locale) {
  const filePath = path.join(bundleRoot, 'lang', `${locale}.json`);
  if (!fs.existsSync(filePath)) return null;
  const table = readJson(filePath);
  return table && typeof table === 'object' ? table : null;
}

function listTargetLocales(bundleRoot, bundle) {
  const fromBundle = Array.isArray(bundle.languages) ? bundle.languages : [];
  const codes = fromBundle
    .filter((code) => typeof code === 'string' && code.length > 0)
    .map((code) => normalizeLocale(code));
  if (codes.length > 0) return [...new Set(codes)];

  const langDir = path.join(bundleRoot, 'lang');
  if (!fs.existsSync(langDir)) return [FALLBACK_LOCALE];
  return fs.readdirSync(langDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => normalizeLocale(name.slice(0, -5)))
    .filter((code) => code.length > 0);
}

function isChineseLocale(locale) {
  return ZH_LOCALE_RE.test(normalizeLocale(locale));
}

function normalizeHaystackToken(text) {
  return stripMinecraftFormatting(text).toLowerCase().trim();
}

function appendHaystackToken(seen, parts, raw) {
  const token = normalizeHaystackToken(raw);
  if (!token || seen.has(token)) return;
  seen.add(token);
  parts.push(token);
}

function pinyinTokensForLabel(label) {
  const plain = stripMinecraftFormatting(label);
  if (!plain || !/[\u4e00-\u9fff]/.test(plain)) return [];
  const syllables = pinyin(plain, { toneType: 'none', type: 'array' });
  if (!syllables.length) return [];
  const spaced = syllables.join(' ');
  const continuous = syllables.join('');
  const out = [];
  if (spaced) out.push(spaced);
  if (continuous && continuous !== spaced) out.push(continuous);
  return out;
}

function buildItemHaystack(id, locale, translateCurrent, translateEn) {
  const seen = new Set();
  const parts = [];

  appendHaystackToken(seen, parts, id);

  const nameCurrent = translateCurrent.translateRegistry(id, 'item');
  appendHaystackToken(seen, parts, nameCurrent);

  if (isChineseLocale(locale)) {
    if (translateEn) {
      const nameEn = translateEn.translateRegistry(id, 'item');
      appendHaystackToken(seen, parts, nameEn);
    }
    for (const py of pinyinTokensForLabel(nameCurrent)) {
      appendHaystackToken(seen, parts, py);
    }
  }

  return parts.join(' ');
}

function buildLocaleIndex(bundleRoot, locale, itemIds, options = {}) {
  const log = options.log;
  const progressEvery = options.progressEvery ?? 5000;
  const loc = normalizeLocale(locale);
  const current = readLangTable(bundleRoot, loc) || {};
  const fallback = loc === FALLBACK_LOCALE
    ? {}
    : (readLangTable(bundleRoot, FALLBACK_LOCALE) || {});
  const translateCurrent = createRegistryLabelResolver({ current, fallback });

  let translateEn = null;
  if (isChineseLocale(loc) && loc !== FALLBACK_LOCALE) {
    const enTable = readLangTable(bundleRoot, FALLBACK_LOCALE) || {};
    translateEn = createRegistryLabelResolver({ current: enTable, fallback: {} });
  }

  const startedAt = Date.now();
  const items = [];
  for (let i = 0; i < itemIds.length; i++) {
    const id = itemIds[i];
    items.push({
      id,
      haystack: buildItemHaystack(id, loc, translateCurrent, translateEn),
    });
    const n = i + 1;
    if (log && progressEvery > 0 && n % progressEvery === 0) {
      log(`[emi-bundle-optimize]   items-search ${loc}: ${n}/${itemIds.length} (${Date.now() - startedAt} ms)`);
    }
  }
  if (log && itemIds.length > 0) {
    log(`[emi-bundle-optimize]   items-search ${loc}: ${itemIds.length} done (${Date.now() - startedAt} ms)`);
  }

  return {
    schema: 1,
    locale: loc,
    itemCount: items.length,
    items,
  };
}

/**
 * Write items-search/<locale>.json for each bundle language (after lang prune).
 * @param {string} bundleRoot
 * @param {{ log?: (msg: string) => void }} [options]
 */
export function buildItemsSearchIndexes(bundleRoot, options = {}) {
  const log = options.log ?? (() => {});
  const bundle = readBundleJson(bundleRoot);
  const itemIds = parseItemIdsFromIndex(bundleRoot);
  const locales = listTargetLocales(bundleRoot, bundle);
  const outDir = path.join(bundleRoot, ITEMS_SEARCH_DIR);
  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const locale of locales) {
    log(`[emi-bundle-optimize]   items-search ${locale}: building (${itemIds.length} items) ...`);
    const payload = buildLocaleIndex(bundleRoot, locale, itemIds, { log });
    const relPath = `${ITEMS_SEARCH_DIR}/${locale}.json`;
    log(`[emi-bundle-optimize]   items-search ${locale}: writing ${relPath} ...`);
    writeJson(path.join(bundleRoot, relPath), payload);
    written.push({ locale, path: relPath, itemCount: payload.itemCount });
    log(`[emi-bundle-optimize] items-search ${locale}: ${payload.itemCount} items`);
  }

  return {
    enabled: true,
    dir: ITEMS_SEARCH_DIR,
    locales: written,
    itemCount: itemIds.length,
  };
}
