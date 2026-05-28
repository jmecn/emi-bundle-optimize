#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';

import { BundleOptimizeError } from '../src/util.mjs';
import { optimizeBundle, printOptimizeOk } from '../src/optimize.mjs';
import { printValidationOk, validateBundle } from '../src/validate.mjs';

const HELP = `emi-bundle-optimize — Phase 2b offline EMI bundle tooling

Usage:
  emi-bundle-optimize validate <bundle-dir>
  emi-bundle-optimize optimize --in <raw-dir> --out <optimized-dir> [options]
  emi-bundle-optimize optimize --in <raw-dir> --dry-run [options]

Commands:
  validate   Contract check (same rules as recipe-viewer validate)
  optimize   Copy bundle, WebP icon atlases (default), stamp bundle.json

Options:
  --force          Remove existing output directory before optimize
  --dry-run        Validate and preview optimize settings without writing files
  --prune-lang     Remove unused translation keys from lang/*.json
  --no-webp        Skip atlas PNG -> WebP (v1-style copy only)
  --keep-png       Keep atlas PNG alongside WebP (larger output)
  --quality        WebP quality 1-100 (alias of --webp-quality)
  --webp-quality   WebP quality 1-100 (default: 88)
  --report         Write optimize-report.json to this path (default: <out>/optimize-report.json)
  -h, --help       Show help
`;

function printHelp() {
  console.log(HELP);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  const command = argv[0];

  try {
    if (command === 'validate') {
      const bundleDir = argv[1] || process.env.EMI_BUNDLE_ROOT;
      if (!bundleDir) {
        console.error('validate: missing bundle directory (argv[1] or EMI_BUNDLE_ROOT)');
        process.exit(1);
      }
      const result = validateBundle(bundleDir);
      printValidationOk(result);
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
          'webp-quality': { type: 'string', default: '88' },
        },
        allowPositionals: false,
      });

      if (!values.in || (!values.out && !values['dry-run'])) {
        console.error('optimize: requires --in <raw-dir> and --out <optimized-dir> (or use --dry-run)');
        process.exit(1);
      }

      const qualityRaw = values.quality ?? values['webp-quality'];
      const webpQuality = Number(qualityRaw);
      if (!Number.isFinite(webpQuality) || webpQuality < 1 || webpQuality > 100) {
        console.error('optimize: --quality/--webp-quality must be between 1 and 100');
        process.exit(1);
      }

      const result = await optimizeBundle({
        inDir: values.in,
        outDir: values.out || path.join(values.in, '.dry-run'),
        force: values.force,
        reportPath: values.report,
        webp: values.webp && !values['no-webp'],
        keepPng: values['keep-png'],
        webpQuality,
        dryRun: values['dry-run'],
        pruneLang: values['prune-lang'],
      });
      printOptimizeOk(result);
      return;
    }

    console.error(`unknown command: ${command}`);
    printHelp();
    process.exit(1);
  } catch (err) {
    if (err instanceof BundleOptimizeError) {
      console.error(`FAIL: ${err.message}`);
      process.exit(1);
    }
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
