# Andrea Signoretti — Portfolio

A single-page personal portfolio on a sea-navigation theme, centered on the aspiration to
contribute to **AI-human augmented reasoning**. Vanilla HTML + CSS + JS, no build step,
no frameworks, no libraries — deployable as static files.

**Live:** https://aindreasi.tech/ (GitHub Pages, custom domain; `blackbull11.github.io` redirects here)

## Structure

```
index.html      all markup + inline SVGs
styles.css      tokens, layout, compass, responsive, a11y
main.js         scroll reveals, nav voyage boat + active link, compass needle
favicon.svg     the boat mark
cv.pdf          placeholder — replace with your real resume (keep the filename)
assets/         portrait.jpg, sticker.png, polytechnique.svg  (see assets/README.md)
```

## Run locally

Any static server works. For example:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploy on GitHub Pages (free)

1. Push this folder to a repo (e.g. `Blackbull11/portfolio`, or `Blackbull11.github.io`
   to serve it at the root domain).
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch **`main`**, folder **`/ (root)`**. Save.
3. Wait ~1 minute. The site publishes at
   `https://blackbull11.github.io/<repo>/` (or `https://blackbull11.github.io/` for the
   `Blackbull11.github.io` repo).

## Custom domain

The `CNAME` file holds `aindreasi.tech`. DNS at OVH (zone `aindreasi.tech`):

| Type | Name | Target |
|---|---|---|
| A | (apex) | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 |
| AAAA | (apex) | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 |
| CNAME | www | blackbull11.github.io. |

Leave `graind` (A → the VPS) untouched. Then **Settings → Pages → Enforce HTTPS**.

## To finish

- Drop the three images into `assets/` (see [assets/README.md](assets/README.md)).
- Replace `cv.pdf` with your real CV (keep the name `cv.pdf`).

Built to hit Lighthouse ≥ 95 across the board. All content is real — no lorem ipsum,
no fabricated links.
