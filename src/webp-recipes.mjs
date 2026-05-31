import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const RECIPES_DIR = 'recipes';

/**
 * Convert recipe card PNGs under recipes/<namespace>/*.png to WebP.
 * @param {string} bundleRoot
 */
export async function convertRecipeCardsToWebp(bundleRoot, options = {}) {
  const quality = options.quality ?? 98;
  const keepPng = options.keepPng ?? false;
  const root = path.resolve(bundleRoot);
  const recipesRoot = path.join(root, RECIPES_DIR);
  const log = options.log ?? (() => {});

  if (!fs.existsSync(recipesRoot)) {
    return { converted: [], skipped: true, pngBytes: 0, webpBytes: 0 };
  }

  const converted = [];
  let pngBytes = 0;
  let webpBytes = 0;
  const pngFiles = [];

  for (const namespace of fs.readdirSync(recipesRoot)) {
    const nsDir = path.join(recipesRoot, namespace);
    if (!fs.statSync(nsDir).isDirectory()) continue;
    for (const name of fs.readdirSync(nsDir)) {
      if (!name.endsWith('.png')) continue;
      pngFiles.push(path.join(nsDir, name));
    }
  }

  if (pngFiles.length === 0) {
    return { converted, skipped: false, pngBytes: 0, webpBytes: 0 };
  }

  log(`[emi-bundle-optimize]   ${pngFiles.length} recipe PNG(s) -> WebP ...`);
  let loggedSample = 0;

  for (const pngPath of pngFiles) {
    const before = fs.statSync(pngPath).size;
    pngBytes += before;
    const webpPath = pngPath.replace(/\.png$/i, '.webp');

    await sharp(pngPath).webp({ quality }).toFile(webpPath);
    const after = fs.statSync(webpPath).size;
    webpBytes += after;

    if (!keepPng) {
      fs.unlinkSync(pngPath);
    }

    const rel = path.relative(root, pngPath).split(path.sep).join('/');
    converted.push({
      from: rel,
      to: rel.replace(/\.png$/i, '.webp'),
      pngBytes: before,
      webpBytes: after,
    });

    if (loggedSample < 3) {
      log(`[emi-bundle-optimize]   ${path.basename(pngPath)}: ${before} -> ${after} bytes`);
      loggedSample += 1;
    }
  }

  if (pngFiles.length > loggedSample) {
    log(`[emi-bundle-optimize]   ... ${pngFiles.length - loggedSample} more recipe image(s)`);
  }

  return { converted, skipped: false, pngBytes, webpBytes };
}
