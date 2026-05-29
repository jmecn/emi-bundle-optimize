# emi-bundle-optimize

Offline CLI: `minecraft-web-export` raw EMI bundle -> optimized copy (Node 18+).

```bash
npm install
node bin/cli.mjs validate /path/to/emi-raw
node bin/cli.mjs optimize --in /path/to/emi-raw --out /path/to/emi-optimized --force
# preview only, write nothing:
node bin/cli.mjs optimize --in /path/to/emi-raw --dry-run --prune-lang --quality 80
```

## Bundle contract (current)

`validate` and `optimize` follow the current EMI index protocol:

- `bundle.json` (`schema: 1`, non-empty `languages`, required `missingIconId`)
- `recipes/index.json` with `namespaces: string[]`
- `recipes/shards/<namespace>.json` per namespace (array of recipe paths)
- `recipes/layouts/<safeFileName(recipeId)>.json` for each recipe id derived from shards
- `textures/manifest.json`
- `icons/index.json`
- `lang/<defaultLanguage>.json` (fallback: `lang/en_us.json`)
- `items/index.json`

Tag files:

- `tags/index.json` is optional (used by app-level tag listing); if present, schema and shape are validated
- legacy `tags/members.json` is no longer required or supported by this tool

Icon atlas modes:

- if `icons/icons.css` exists, CSS atlas mode is accepted
- if `icons/icons.css` is missing, `icons/index.json` must provide inline atlas coordinates (`page/x/y`)

## Commands

`validate`:

- checks bundle contract consistency
- verifies every recipe id from `recipes/index + shards` has a corresponding layout JSON

`optimize`:

- copies the input bundle to output
- runs contract validation
- converts `icons/atlas-*.png` to WebP by default (can skip via `--no-webp`)
- optionally prunes unused translation keys from `lang/*.json` (via `--prune-lang`)
- writes optimization metadata into `bundle.json`
- writes `optimize-report.json` (except `--dry-run`)

## Optimize options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--in` | string | required | Input raw bundle directory |
| `--out` | string | required unless `--dry-run` | Output optimized bundle directory |
| `--force` | boolean | `false` | Remove existing non-empty output directory before optimize |
| `--dry-run` | boolean | `false` | Validate and preview optimize settings without writing files |
| `--prune-lang` | boolean | `false` | Remove unused translation keys from `lang/*.json` |
| `--no-webp` | boolean | `false` | Skip atlas PNG -> WebP conversion |
| `--keep-png` | boolean | `false` | Keep original PNG atlas files after WebP conversion |
| `--quality` | number | `88` | WebP quality (`1-100`), alias of `--webp-quality` |
| `--webp-quality` | number | `88` | WebP quality (`1-100`) |
| `--report` | string | `<out>/optimize-report.json` | Custom path for optimization report JSON |

## npm package

Install as a CLI dependency (same pattern as [emi-recipe-renderer](https://github.com/jmecn/emi-recipe-renderer)):

```bash
npm install emi-bundle-optimize@0.1.0
npx emi-bundle-optimize optimize --in ./export-raw/emi --out ./export-opt --force --prune-lang
```

Published files: `bin/`, `src/`, `LICENSE`, `README.md` (see `package.json` `files`).

## Development

- Node `>=18`
- Test: `npm test`
- `npm publish` runs `prepublishOnly` (`npm test`) before upload
- GitHub Actions **Publish npm package** runs on **Release published** and uses the release tag (for example `v0.1.0`); it skips if that version already exists on npm
- CI (`ci.yml`) runs on push/PR to `master` / `main`

## Release checklist

1. Merge changes into `master`.
2. Bump `package.json` `version` on `master` (must be a new version on npm).
3. Local sanity check:
   - `npm ci`
   - `npm test`
4. Commit, push `master`, then create and push a matching tag (example: `v0.1.0` for version `0.1.0`).
5. On GitHub: **Releases → Draft a new release** → choose that tag → **Publish release**.
6. Wait for the **Publish npm package** workflow to finish (requires repo secret `NPM_TOKEN` with publish access).
7. Verify: `npm view emi-bundle-optimize version`
