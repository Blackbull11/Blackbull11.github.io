# Assets — drop your images here

The site works immediately with styled placeholders, but it looks its best once you
add these three files. **Use these exact filenames** (all lowercase) so no code changes
are needed.

| File | What it is | Where it appears | Recommended |
|------|------------|------------------|-------------|
| `portrait.jpg` | Your professional headshot (the suit photo) | Hero, "chart-pinned" frame | Portrait crop ~4:5, ≥ 600×750px, < 300 KB |
| `sticker.png` | The cut-out sticker of your face (sunglasses shot) | The little captain on the hero boat **and** the boat that sails down the route line | Square, **transparent background** if possible, ~200×200px |
| `polytechnique.svg` | École Polytechnique logo | The "École Polytechnique · X24" badge in the hero | SVG or PNG; small square mark works best |

### Notes
- **`sticker.png` – transparency matters.** The image is clipped into a round "porthole"
  on the boat. A transparent PNG (just your face, no black rectangle) looks cleanest.
  You can cut it out for free at remove.bg or in any photo editor.
- If a file is missing, you'll see a tasteful navy/ocean placeholder instead of a broken
  image — nothing will look broken while you gather the assets.
- Optional: add `og-image.png` (1200×630) for nicer link previews when the site is shared
  on LinkedIn / social. It's referenced in `index.html`'s `og:image` meta tag.

### How to add them
Copy the three files into this `assets/` folder, then:

```bash
git add assets
git commit -m "Add portrait, face sticker, and Polytechnique logo"
git push
```

GitHub Pages will redeploy automatically within a minute.
