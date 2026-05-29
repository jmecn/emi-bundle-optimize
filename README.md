# emi-bundle-optimize

Post-process [minecraft-web-export](https://github.com/jmecn/minecraft-web-export) EMI bundles for static hosting: **icon atlas WebP** and optional **lang key pruning**.

Schema validation is delegated to [emi-recipe-renderer](https://github.com/jmecn/emi-recipe-renderer) (`validate` command).

```bash
npm install emi-bundle-optimize emi-recipe-renderer
npx emi-bundle-optimize validate ./emi
npx emi-bundle-optimize optimize --in ./emi-raw --out ./emi-opt --force --prune-lang
```

Node ≥18.

## Commands

| Command | Role |
|---------|------|
| **`validate`** | JSON Schema check (`emi-recipe-renderer/validate`) |
| **`optimize`** | Copy bundle → WebP atlases (default) → optional `--prune-lang` → stamp `bundle.json` |

`optimize` does **not** re-validate, repack routes/layouts, or rewrite the recipe index. Run `validate` separately in CI if needed.

## Options (`optimize`)

| Option | Default | Description |
|--------|---------|-------------|
| `--in` | — | Input bundle directory |
| `--out` | — | Output directory (omit with `--dry-run`) |
| `--force` | off | Replace existing `--out` |
| `--dry-run` | off | Preview WebP/lang settings without writing |
| `--prune-lang` | off | Drop unused keys in `lang/*.json` |
| `--no-webp` | off | Skip PNG→WebP |
| `--keep-png` | off | Keep PNG after WebP |
| `--quality` | `88` | WebP quality (1–100) |

## Lang prune

Keeps keys referenced by layouts, `items/index.json`, `categories/index.json` (`nameKey`), and `tags/index.json`.

## Development

```bash
npm test
```

Requires `emi-recipe-renderer` (local monorepo: `file:../emi-recipe-renderer`).
