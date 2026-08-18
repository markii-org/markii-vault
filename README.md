# Mark II Vault

Curated examples of [Mark](https://github.com/sadigaxund/markii) documents
(`.mk.md`), shown as living notes: the source on the left, the rendered page
on the right. Each example runs its own scripts against a curated host
allowlist, so what you see is the actual note doing its actual job.

The first entry is a live weather dashboard for Baku built on Open-Meteo
forecast data, with a weekly chart, current conditions, and a 30-minute
cache.

## Viewing

- **Published site:** <https://sadigaxund.github.io/markii-vault/>
- **Locally:** `npm install`, then `npm run dev` (or `npm run build` +
  `npm run preview`).
- **Navigate:** the toolbar's `‹ Prev / Next ›` buttons, the dropdown, or
  the `←` / `→` keys. Each example has its own URL (`#baku-weather`).

## Adding an example

1. Create `examples/02-<slug>/note.mk.md` in this repo. The `01-` style
   prefix sets the order; the slug becomes the URL hash.
2. Give the note a `title` and `description` in a frontmatter block at the
   top. The nav bar reads those; everything after is plain Mark.
3. Push to `main`. The Pages workflow rebuilds and deploys automatically.

One rule: scripts may only call hosts listed in `DEMO_NET_GRANTS` in
`src/script-host.ts` (per-host grants, no wildcards). If a new example
needs a new host, add it there with a comment explaining why, in the same
commit.

## What is Mark?

Mark is an extensible markdown format: CommonMark plus generic directives
that render the author's own React components. The product is the file
format and its reference library. Read the docs in the
[main repository](https://github.com/sadigaxund/markii) (spec, format,
scripting, bundles, security, integration).

## License

MIT. Examples are meant to be copied.