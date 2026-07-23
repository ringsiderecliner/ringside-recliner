# Website images

Use 1600 × 900 images for featured artwork when possible.

- `images/shows/` — one main featured image per show
- `images/posts/` — post featured images and images inserted inside the article copy
- `images/branding/default-feature.svg` — final featured-image fallback

A post's featured image falls back from post → show → default.

For an image inside the writing, use a project-root path in Markdown:

```markdown
![Useful alt text](images/posts/show-slug/image.jpg "Optional visible caption")
```

Add `{wide}` at the end for a wider layout.

Before publishing personal photographs, remove EXIF/GPS metadata. Also inspect screenshots for real names, account avatars, notifications, browser profiles, and local file paths.
