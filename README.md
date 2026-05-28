# emi-bundle-optimize

Offline CLI: `minecraft-web-export` raw EMI bundle -> optimized copy (Node 18+).

```bash
npm install
node bin/cli.mjs validate /path/to/emi-raw
node bin/cli.mjs optimize --in /path/to/emi-raw --out /path/to/emi-optimized [--force]
# default: convert icons/atlas-*.png to WebP; skip with --no-webp
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
- writes optimization metadata into `bundle.json`
- writes `optimize-report.json`

## Optimize options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `--in` | string | required | Input raw bundle directory |
| `--out` | string | required | Output optimized bundle directory |
| `--force` | boolean | `false` | Remove existing non-empty output directory before optimize |
| `--no-webp` | boolean | `false` | Skip atlas PNG -> WebP conversion |
| `--keep-png` | boolean | `false` | Keep original PNG atlas files after WebP conversion |
| `--webp-quality` | number | `88` | WebP quality (`1-100`) |
| `--report` | string | `<out>/optimize-report.json` | Custom path for optimization report JSON |

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

- `tags/index.json` is optional (used by app-level tag listing); if present, schema/shape is validated
- legacy `tags/members.json` is no longer required or supported by this tool

Icon atlas modes:

- If `icons/icons.css` exists, CSS atlas mode is accepted
- If `icons/icons.css` is missing, `icons/index.json` must provide inline atlas coordinates (`page/x/y`) for icons

## Commands

`validate`:

- checks bundle contract consistency
- verifies every recipe id from `recipes/index + shards` has a corresponding layout JSON

`optimize`:

- copies the input bundle to output
- runs contract validation
- converts `icons/atlas-*.png` to WebP by default (can skip via `--no-webp`)
- writes optimization metadata back into `bundle.json`
- writes `optimize-report.json`