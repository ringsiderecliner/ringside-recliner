# Ringside Recliner v0.7

A content-driven static pro-wrestling blog. Each show becomes a viewing hub, while every note within it also becomes a standalone archive post.

v0.7 adds inline article images and a repository-ready GitHub Pages workflow.

## Preview the website

The included HTML has already been built, so `index.html` can be opened directly.

For live writing preview:

```powershell
npm start
```

Open `http://localhost:4173` and keep the terminal running. Press **Ctrl + C** to stop it.

## Build after editing

```powershell
npm run build
```

The build updates the homepage, Shows page, show hubs, post pages, archive, RSS, sitemap, and navigation.

## Add a show

1. Add its featured image to `images/shows/`.
2. Duplicate `content/shows/_show-template.md`.
3. Rename the copy, for example `raw-2026-07-20.md`.
4. Fill in the front matter and write the overall show introduction below it.
5. Use a unique `slug`.

## Add an individual post

1. Duplicate `content/posts/_post-template.md`.
2. Rename it using lowercase hyphenated words.
3. Set `show_slug` to the exact slug of the related show.
4. Set `note_number` to control its order inside the show.
5. Add an optional featured image to `images/posts/`.
6. Write below the second `---` line.
7. Run `npm run build`.

## Put an image in the middle of a post

Place the image inside `images/posts/`, preferably in a folder for the show:

```text
images/posts/raw-2026-07-20/crowd-reaction.jpg
```

Then place this on its own line between two paragraphs:

```markdown
![Describe what is visible in the image.](images/posts/raw-2026-07-20/crowd-reaction.jpg "Optional caption shown below the image.")
```

For a wider image:

```markdown
![Describe what is visible.](images/posts/raw-2026-07-20/full-ring.jpg "Optional caption."){wide}
```

Rules:

- Leave a blank line above and below the image line.
- Write paths from the project root using `images/...`.
- Do not use `../images/...`.
- Avoid spaces in file names.
- Alt text belongs inside `[ ]`; the optional visible caption belongs in quotes.
- The build stops with a clear error if a local inline image is missing.

Inline images use the same taped, aged-print treatment as the rest of the design and resize safely on mobile.

## Featured-image fallback

A post card and header use images in this order:

1. the post's `featured_image`;
2. the linked show's `featured_image`;
3. `default_featured_image` in `site.config.json`.

Delete the `featured_image` line from a post when it should inherit the show image.

```yaml
featured_image: images/posts/example.jpg
featured_image_alt: A useful description of what is shown.
image_position: 50% 35%
image_caption: Optional caption.
image_credit: Optional source or photographer credit.
```

## GitHub and automatic publishing

Follow [GITHUB_SETUP.md](GITHUB_SETUP.md).

The included GitHub Actions workflow builds the site and publishes only the clean web bundle, not the Markdown source and authoring tools, to GitHub Pages.

You can test that deploy bundle locally with:

```powershell
npm run deploy:check
```

The publishable files will appear temporarily in `_site/`, which Git ignores.

## Image safety and rights

Use original, licensed, or otherwise lawfully reusable images. Do not assume television screenshots or promotional photography are automatically free to republish.

For an anonymous site, strip location/device metadata from personal photographs and inspect screenshots for profile names, notifications, local paths, and other identifying details before committing them.
