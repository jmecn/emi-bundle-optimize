import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { readJson, writeJson } from './util.mjs';

const ATLAS_PNG = /^atlas-\d+\.png$/i;

export async function convertIconAtlasesToWebp(iconsDir, options = {}) {
  const quality = options.quality ?? 95;
  const keepPng = options.keepPng ?? false;
  const root = path.resolve(iconsDir);

  if (!fs.existsSync(root)) {
    return { converted: [], skipped: true };
  }

  const converted = [];

  for (const name of fs.readdirSync(root)) {
    if (!ATLAS_PNG.test(name)) continue;

    const pngPath = path.join(root, name);
    const webpName = name.replace(/\.png$/i, '.webp');
    const webpPath = path.join(root, webpName);
    const pngBytes = fs.statSync(pngPath).size;

    await sharp(pngPath).webp({ quality }).toFile(webpPath);
    const webpBytes = fs.statSync(webpPath).size;

    if (!keepPng) {
      fs.unlinkSync(pngPath);
    }

    converted.push({ from: name, to: webpName, pngBytes, webpBytes });
  }

  if (converted.length === 0) {
    return { converted, skipped: false };
  }

  rewriteIconsCss(root, converted);
  rewriteIconsIndex(root, converted, keepPng);

  return { converted, skipped: false };
}

function rewriteIconsCss(iconsDir, converted) {
  const cssPath = path.join(iconsDir, 'icons.css');
  if (!fs.existsSync(cssPath)) return;

  let css = fs.readFileSync(cssPath, 'utf8');
  for (const { from, to } of converted) {
    css = css.replaceAll(`url('${from}')`, `url('${to}')`);
    css = css.replaceAll(`url("${from}")`, `url("${to}")`);
  }
  fs.writeFileSync(cssPath, css, 'utf8');
}

function rewriteIconsIndex(iconsDir, converted, keepPng) {
  const indexPath = path.join(iconsDir, 'index.json');
  if (!fs.existsSync(indexPath)) return;

  const byPng = new Map(converted.map((entry) => [entry.from, entry]));
  const index = readJson(indexPath);

  if (!Array.isArray(index.pages)) return;

  index.pages = index.pages.map((page) => rewriteIconPage(page, byPng, keepPng));
  writeJson(indexPath, index);
}

function rewriteIconPage(page, byPng, keepPng) {
  if (!page || typeof page !== 'object') return page;

  if (Array.isArray(page.sources) && page.sources.length > 0) {
    const sources = [];
    for (const source of page.sources) {
      const file = source?.file || source?.src;
      if (file && byPng.has(file)) {
        const { from, to } = byPng.get(file);
        sources.push({ type: 'image/webp', file: to });
        if (keepPng) sources.push({ type: 'image/png', file: from });
      } else {
        sources.push(source);
      }
    }
    return { ...page, sources, file: undefined, src: undefined };
  }

  const file = page.file || page.src;
  if (!file || !byPng.has(file)) return page;

  const { from, to } = byPng.get(file);
  if (keepPng) {
    return {
      ...page,
      file: undefined,
      src: undefined,
      sources: [
        { type: 'image/webp', file: to },
        { type: 'image/png', file: from },
      ],
    };
  }

  return {
    ...page,
    file: to,
    src: undefined,
    sources: undefined,
  };
}
