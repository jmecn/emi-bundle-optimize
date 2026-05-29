#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';

import { optimizeBundle, printOptimizeOk } from '../src/optimize.mjs';
import { printValidationOk, validateBundle } from '../src/validate.mjs';
import { BundleOptimizeError } from '../src/util.mjs';

const HELP = `emi-bundle-optimize — EMI bundle post-process (WebP atlases, lang prune)

Usage:
  emi-bundle-optimize validate <bundle-dir>
  emi-bundle-optimize optimize --in <raw-dir> --out <optimized-dir> [options]
  emi-bundle-optimize optimize --in <raw-dir> --dry-run [options]

Commands:
  validate   JSON Schema check (emi-recipe-renderer)
  optimize   Copy bundle, WebP icon atlases (default), optional lang prune

Options:
  --force          Remove existing output directory before optimize
  --dry-run        Preview optimize settings without writing files
  --prune-lang     Remove unused translation keys from lang/*.json
  --no-webp        Skip atlas PNG -> WebP
  --keep-png       Keep atlas PNG alongside WebP
  --quality        WebP quality 1-100 (alias of --webp-quality)
  --webp-quality   WebP quality 1-100 (default: 98)
  --report         Write optimize-report.json to this path (default: <out>/optimize-report.json)
  -h, --help       Show help
`;

function exitWithError(err) {
  const message = err instanceof BundleOptimizeError
    ? `FAIL: ${err.message}`
    : (err instanceof Error ? err.message : String(err));
  console.error(message);
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    console.log(HELP);
    process.exit(argv.length === 0 ? 1 : 0);
  }

  try {
    const command = argv[0];

    if (command === 'validate') {
      const bundleDir = argv[1] || process.env.EMI_BUNDLE_ROOT;
      if (!bundleDir) {
        console.error('validate: missing bundle directory (argv[1] or EMI_BUNDLE_ROOT)');
        process.exit(1);
      }
      printValidationOk(validateBundle(bundleDir));
      return;
    }

    if (command === 'optimize') {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: {
          in: { type: 'string' },
          out: { type: 'string' },
          force: { type: 'boolean', default: false },
          'dry-run': { type: 'boolean', default: false },
          'prune-lang': { type: 'boolean', default: false },
          report: { type: 'string' },
          webp: { type: 'boolean', default: true },
          'no-webp': { type: 'boolean', default: false },
          'keep-png': { type: 'boolean', default: false },
          quality: { type: 'string' },
          'webp-quality': { type: 'string', default: '98' },
        },
        allowPositionals: false,
      });

      if (!values.in || (!values.out && !values['dry-run'])) {
        console.error('optimize: requires --in <raw-dir> and --out <optimized-dir> (or use --dry-run)');
        process.exit(1);
      }

      const webpQuality = Number(values.quality ?? values['webp-quality']);
      if (!Number.isFinite(webpQuality) || webpQuality < 1 || webpQuality > 100) {
        console.error('optimize: --quality/--webp-quality must be between 1 and 100');
        process.exit(1);
      }

      printOptimizeOk(await optimizeBundle({
        inDir: values.in,
        outDir: values.out || path.join(values.in, '.dry-run'),
        force: values.force,
        reportPath: values.report,
        webp: values.webp && !values['no-webp'],
        keepPng: values['keep-png'],
        webpQuality,
        dryRun: values['dry-run'],
        pruneLang: values['prune-lang'],
      }));
      return;
    }

    console.error(`unknown command: ${command}`);
    console.log(HELP);
    process.exit(1);
  } catch (err) {
    exitWithError(err);
  }
}

main().catch(exitWithError);
