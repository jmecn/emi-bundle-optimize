# emi-bundle-optimize

Post-process [minecraft-web-export](https://github.com/jmecn/minecraft-web-export) EMI bundles for static hosting: **icon atlas WebP**, **recipe card WebP** (`bundle.recipeImageFormat`), and optional **lang key pruning**.

Schema validation is delegated to [emi-recipe-renderer](https://github.com/jmecn/emi-recipe-renderer) (`validate` command).

```bash
npm install emi-bundle-optimize
npx emi-bundle-optimize validate ./emi
npx emi-bundle-optimize optimize --in ./emi-raw --out ./emi-opt --force --prune-lang
```

Node ≥18.

## Commands

| Command | Role |
|---------|------|
| **`validate`** | JSON Schema check (`emi-recipe-renderer/validate`) |
| **`optimize`** | Copy bundle → WebP icon atlases + recipe PNGs (default) → set `recipeImageFormat: webp` → optional `--prune-lang` → stamp `bundle.json` |

`optimize` does **not** re-validate, repack routes/layouts, or rewrite the recipe index. Run `validate` separately in CI if needed.

## Options (`optimize`)

| Option | Default | Description |
|--------|---------|-------------|
| `--in` | — | Input bundle directory |
| `--out` | — | Output directory (omit with `--dry-run`) |
| `--force` | off | Replace existing `--out` |
| `--dry-run` | off | Preview WebP/lang settings without writing |
| `--prune-lang` | off | Drop unused keys in `lang/*.json` |
| `--no-webp` | off | Skip all PNG→WebP |
| `--no-recipe-webp` | off | Skip recipe card WebP only (icons still WebP; `recipeImageFormat` stays `png`) |
| `--keep-png` | off | Keep PNG alongside WebP (bundle still uses `recipeImageFormat: webp` when any recipe was converted) |
| `--quality` | `98` | WebP quality (1–100) |

## Lang prune

Keeps keys referenced by recipe meta, `items/index.json`, `categories/index.json` (`nameKey`), and `tags/index.json`. GregTech CEu uses the same composed-lang rules as `emi-recipe-renderer` (`gtceu-translate.js`).

## Release

Push a tag matching `package.json` (e.g. `v0.4.0`). The [Release workflow](.github/workflows/release.yml) runs tests, creates a GitHub Release, and publishes to npm (`NPM_TOKEN` secret required).

## Development

```bash
npm test
```

Requires `emi-recipe-renderer@^0.5.0` (schema v2 bundles; installed automatically as a dependency).
