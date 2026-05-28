import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readJson } from './util.mjs';
import { collectTreeStats, formatBytes } from './stats.mjs';
import { validateBundle } from './validate.mjs';
import { compactRecipeIndexIfNeeded } from './compact-recipe-index.mjs';
import { convertIconAtlasesToWebp } from './webp-icons.mjs';

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PACKAGE_VERSION = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
).version;

/**
 * @param {{
 *   inDir: string,
 *   outDir: string,
 *   force?: boolean,
 *   reportPath?: string,
 *   webp?: boolean,
 *   webpQuality?: number,
 *   keepPng?: boolean,
 * }} options
 */
export async function optimizeBundle(options) {
  const inDir = path.resolve(options.inDir);
  const outDir = path.resolve(options.outDir);
  const force = Boolean(options.force);
  const webp = options.webp !== false;
  const webpQuality = options.webpQuality ?? 88;
  const keepPng = Boolean(options.keepPng);

  if (inDir === outDir) {
    throw new Error('input and output directories must differ');
  }

  if (fs.existsSync(outDir)) {
    const existing = fs.readdirSync(outDir);
    if (existing.length > 0 && !force) {
      throw new Error(
        `output directory is not empty: ${outDir} (use --force to overwrite after removing contents)`,
      );
    }
    if (force) {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }

  const inStats = collectTreeStats(inDir);

  const startedAt = Date.now();
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(inDir, outDir, { recursive: true, dereference: true });

  const recipeIndexCompacted = compactRecipeIndexIfNeeded(outDir);
  const validation = validateBundle(outDir);

  let webpResult = null;
  if (webp) {
    webpResult = await convertIconAtlasesToWebp(path.join(outDir, 'icons'), {
      quality: webpQuality,
      keepPng,
    });
  }

  const bundlePath = path.join(outDir, 'bundle.json');
  const bundle = readJson(bundlePath);
  bundle.profile = 'optimized';
  bundle.optimizedBy = `emi-bundle-optimize@${PACKAGE_VERSION}`;
  bundle.optimizedFrom = inDir;
  bundle.optimizedAt = new Date().toISOString();
  if (webp && webpResult?.converted?.length) {
    bundle.iconAtlases = keepPng ? 'webp+png' : 'webp';
  }
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');

  const outStats = collectTreeStats(outDir);
  const elapsedMs = Date.now() - startedAt;

  const report = {
    tool: 'emi-bundle-optimize',
    version: PACKAGE_VERSION,
    phase: webp ? '2b-v2' : '2b-v1',
    input: inDir,
    output: outDir,
    elapsedMs,
    inputStats: inStats,
    outputStats: outStats,
    recipeCount: validation.recipeCount,
    profile: bundle.profile,
    recipeIndexCompacted,
    webp: webpResult,
  };

  const defaultReportPath = path.join(outDir, 'optimize-report.json');
  const reportPath = options.reportPath ? path.resolve(options.reportPath) : defaultReportPath;
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return { report, reportPath, validation };
}

export function printOptimizeOk(result) {
  const { report, reportPath } = result;
  console.log(`OK: optimized bundle -> ${report.output}`);
  console.log(`  profile: ${report.profile}`);
  console.log(`  phase: ${report.phase}`);
  console.log(`  recipes: ${report.recipeCount}`);
  console.log(
    `  size: ${formatBytes(report.inputStats.byteCount)} -> ${formatBytes(report.outputStats.byteCount)} (${report.inputStats.fileCount} -> ${report.outputStats.fileCount} files)`,
  );
  const webp = report.webp?.converted;
  if (webp?.length) {
    const saved = webp.reduce((n, entry) => n + (entry.pngBytes - entry.webpBytes), 0);
    console.log(
      `  icon atlases: ${webp.length} PNG -> WebP (saved ~${formatBytes(Math.max(0, saved))})`,
    );
  }
  console.log(`  elapsed: ${report.elapsedMs} ms`);
  console.log(`  report: ${reportPath}`);
}
