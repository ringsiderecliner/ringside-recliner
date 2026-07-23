const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
if (process.env.SITE_URL) config.site_url = process.env.SITE_URL;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function parseValue(raw) {
  const value = raw.trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') || value.startsWith('{')) {
    try { return JSON.parse(value); } catch { return value; }
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseContent(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  if (!source.startsWith('---\n')) throw new Error(`${filePath} needs a front-matter block.`);
  const end = source.indexOf('\n---\n', 4);
  if (end === -1) throw new Error(`${filePath} has an unclosed front-matter block.`);
  const rawMeta = source.slice(4, end);
  const body = source.slice(end + 5).trim();
  const data = {};
  for (const line of rawMeta.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    data[line.slice(0, colon).trim()] = parseValue(line.slice(colon + 1));
  }
  return { ...data, body, sourcePath: filePath };
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function isExternalAsset(src = '') {
  return /^(?:https?:)?\/\//i.test(src) || /^(?:data|mailto|tel):/i.test(src) || src.startsWith('#');
}

function normaliseContentAsset(src = '', sourcePath = '') {
  const raw = String(src).trim().replaceAll('\\', '/');
  if (!raw) throw new Error(`${sourcePath || 'Markdown'} contains an image with no path.`);
  if (isExternalAsset(raw)) return { src: raw, localPath: '' };

  const withoutLeadingSlash = raw.replace(/^\/+/, '').replace(/^\.\//, '');
  const clean = path.posix.normalize(withoutLeadingSlash);
  if (clean === '..' || clean.startsWith('../')) {
    throw new Error(`${sourcePath || 'Markdown'} uses an image path outside the project: ${raw}. Use images/... from the project root.`);
  }
  const localPath = path.resolve(ROOT, clean.split(/[?#]/)[0]);
  if (!localPath.startsWith(`${ROOT}${path.sep}`) && localPath !== ROOT) {
    throw new Error(`${sourcePath || 'Markdown'} uses an invalid image path: ${raw}`);
  }
  if (!fs.existsSync(localPath)) {
    throw new Error(`${sourcePath || 'Markdown'} references a missing inline image: ${clean}`);
  }
  return { src: clean, localPath };
}

function inlineFigure(rawLine, { prefix = '', sourcePath = '' } = {}) {
  const match = rawLine.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*(?:\{(wide)\})?$/);
  if (!match) return '';
  const [, alt, rawSrc, caption = '', layout = ''] = match;
  const asset = normaliseContentAsset(rawSrc, sourcePath);
  const src = isExternalAsset(asset.src) ? asset.src : relative(prefix, asset.src);
  const className = layout ? ` inline-figure-${layout}` : '';
  return `<figure class="inline-figure${className}">
    <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
    ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}
  </figure>`;
}

function markdownToHtml(markdown = '', options = {}) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listType) return;
    html.push(`<${listType}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const figure = inlineFigure(raw, options);
    if (figure) { flushParagraph(); flushList(); html.push(figure); continue; }
    if (/^---+$/.test(line)) { flushParagraph(); flushList(); html.push('<hr>'); continue; }
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith('> ')) {
      flushParagraph(); flushList();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unordered || ordered)[1]);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph(); flushList();
  return html.join('\n');
}

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function dateParts(dateString) {
  const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Invalid date: ${dateString}. Use YYYY-MM-DD.`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
function longDate(dateString) {
  const d = dateParts(dateString);
  return `${d.day} ${monthNames[d.month - 1]} ${d.year}`;
}
function rssDate(dateString) {
  return new Date(`${dateString}T12:00:00Z`).toUTCString();
}
function typeSlug(type = 'Post') {
  return String(type).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function padNote(value) { return String(value).padStart(2, '0'); }
function relative(prefix, assetPath) { return `${prefix}${assetPath}`; }
function absoluteUrl(assetPath) {
  if (!config.site_url) return assetPath;
  return `${config.site_url.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
}
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trimStart(), 'utf8');
}
function loadDirectory(dir) {
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .map((name) => parseContent(path.join(dir, name)));
}
function cleanGenerated(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of fs.readdirSync(dir)) {
    if (entry.endsWith('.html')) fs.unlinkSync(path.join(dir, entry));
  }
}

function imageData(item, show) {
  const own = item?.featured_image;
  const showImage = show?.featured_image;
  const src = own || showImage || config.default_featured_image;
  return {
    src,
    alt: item?.featured_image_alt || show?.featured_image_alt || `${item?.title || show?.title || config.site_name} featured artwork`,
    position: item?.image_position || show?.image_position || '50% 50%',
    caption: item?.image_caption || (own ? '' : show?.image_caption || ''),
    credit: item?.image_credit || (own ? '' : show?.image_credit || ''),
    source: own ? 'post' : showImage ? 'show' : 'default'
  };
}

function head({ title, description, prefix = '', image }) {
  const imageHref = image ? (config.site_url ? absoluteUrl(image) : relative(prefix, image)) : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | ${escapeHtml(config.site_name)}</title>
  <meta name="description" content="${escapeHtml(description || config.description)}">
  <meta name="color-scheme" content="light">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description || config.description)}">
  <meta property="og:type" content="article">
  ${imageHref ? `<meta property="og:image" content="${escapeHtml(imageHref)}">` : ''}
  <link rel="stylesheet" href="${prefix}style.css">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.site_name)} RSS" href="${prefix}rss.xml">
</head>`;
}

function siteHeader(prefix = '', activePage = '') {
  const navLink = (key, href, label) => {
    const isActive = activePage === key;
    return `<a${isActive ? ' class="nav-current" aria-current="page"' : ''} href="${prefix}${href}">${label}</a>`;
  };
  return `<div class="screen-noise" aria-hidden="true"></div>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header shell">
  <div class="masthead paper torn-bottom">
    <div class="brand-block">
      <p class="eyebrow">CHANNEL 03 // HOME VIDEO ARCHIVE</p>
      <a class="logo" href="${prefix}index.html">${escapeHtml(config.site_name)}</a>
      <p class="tagline">${escapeHtml(config.tagline)}</p>
    </div>
    <nav class="nav" aria-label="Main navigation">
      ${navLink('home', 'index.html', 'Home')}
      ${navLink('shows', 'shows.html', 'Shows')}
      ${navLink('archive', 'archive.html', 'Post Archive')}
      ${navLink('about', 'about.html', 'About')}
      <a href="${prefix}rss.xml">RSS</a>
    </nav>
  </div>
</header>`;
}

function siteFooter(prefix = '') {
  return `<footer class="site-footer shell">
  <div class="paper footer-inner">
    <p>© <span data-year></span> ${escapeHtml(config.site_name)}. Anonymous couch commentary. No affiliation with any wrestling promotion.</p>
    <p class="microcopy">Built like a forgotten fan-zine and held together with tape.</p>
  </div>
</footer>
<script src="${prefix}script.js"></script>`;
}

function documentPage({ title, description, prefix = '', bodyClass = '', image, content, activePage = '' }) {
  return `${head({ title, description, prefix, image })}
<body class="${bodyClass}">
${siteHeader(prefix, activePage)}
${content}
${siteFooter(prefix)}
</body>
</html>`;
}

function featureFigure(img, prefix = '', className = '') {
  const fallbackText = img.source === 'post' ? '' : img.source === 'show' ? 'Using the show image' : 'Using the default image';
  return `<figure class="feature-frame ${className}" data-image-source="${img.source}">
    <img class="feature-image" src="${escapeHtml(relative(prefix, img.src))}" alt="${escapeHtml(img.alt)}" style="object-position:${escapeHtml(img.position)}" loading="lazy">
    ${(img.caption || img.credit || fallbackText) ? `<figcaption class="feature-caption"><span>${escapeHtml(img.caption || fallbackText)}</span><span>${escapeHtml(img.credit || '')}</span></figcaption>` : ''}
  </figure>`;
}

function cardImage(img, prefix = '') {
  return `<a class="card-feature" href="#IMAGE_LINK#" aria-label="#IMAGE_LABEL#"><img src="${escapeHtml(relative(prefix, img.src))}" alt="${escapeHtml(img.alt)}" style="object-position:${escapeHtml(img.position)}" loading="lazy"></a>`;
}

const shows = loadDirectory(path.join(CONTENT, 'shows'));
const posts = loadDirectory(path.join(CONTENT, 'posts'));
const showMap = new Map(shows.map((show) => [show.slug, show]));

for (const show of shows) {
  for (const field of ['title','date','slug']) if (!show[field]) throw new Error(`${show.sourcePath} is missing ${field}.`);
}
for (const post of posts) {
  for (const field of ['title','date','slug','show_slug','note_number','type','excerpt']) if (post[field] === undefined || post[field] === '') throw new Error(`${post.sourcePath} is missing ${field}.`);
  if (!showMap.has(post.show_slug)) throw new Error(`${post.sourcePath} references unknown show_slug: ${post.show_slug}`);
}

shows.sort((a,b) => b.date.localeCompare(a.date));
posts.sort((a,b) => b.date.localeCompare(a.date) || Number(a.note_number) - Number(b.note_number));
for (const show of shows) {
  show.posts = posts.filter((post) => post.show_slug === show.slug).sort((a,b) => Number(a.note_number) - Number(b.note_number));
}

cleanGenerated(path.join(ROOT, 'posts'));
cleanGenerated(path.join(ROOT, 'shows'));

function renderHomePost(post) {
  const show = showMap.get(post.show_slug);
  const img = imageData(post, show);
  const href = `posts/${post.slug}.html`;
  return `<article class="post-card paper has-image" data-filter-item data-type="${typeSlug(post.type)}">
    <div class="post-number">${padNote(post.note_number)}</div>
    <div>
      <p class="post-meta">${escapeHtml(post.type)} · ${escapeHtml(post.read_time || '')} · ${escapeHtml(show.title)}</p>
      <h3><a href="${href}">${escapeHtml(post.title)}</a></h3>
      <p>${escapeHtml(post.excerpt)}</p>
      <a class="text-link" href="${href}">Read this note <span aria-hidden="true">→</span></a>
    </div>
    ${cardImage(img).replace('#IMAGE_LINK#', href).replace('#IMAGE_LABEL#', `Read ${escapeHtml(post.title)}`)}
  </article>`;
}

function renderHomeShowCard(show, index) {
  const img = imageData(show, null);
  const href = `shows/${show.slug}.html`;
  return `<article class="home-show-card">
    ${cardImage(img).replace('#IMAGE_LINK#', href).replace('#IMAGE_LABEL#', `Open ${escapeHtml(show.title)}`)}
    <div class="home-show-card-copy">
      <div class="cassette-label"><span>${index === 0 ? 'LATEST TAPE' : `TAPE ${escapeHtml(String(show.tape || '---'))}`}</span><span>${show.posts.length} NOTES</span></div>
      <p class="post-meta">${longDate(show.date)} · ${escapeHtml(show.format || '')}</p>
      <h3><a href="${href}">${escapeHtml(show.title)}</a></h3>
      <p>${escapeHtml(show.summary)}</p>
      <a class="text-link" href="${href}">Open show notes →</a>
    </div>
  </article>`;
}

const latestShow = shows[0];
const latestShowImg = imageData(latestShow, null);
const homeContent = `<main id="main" class="shell home-layout">
  <section class="hero paper crooked-right">
    <div class="stamp">NOT JOURNALISM</div>
    <p class="eyebrow">ANONYMOUS · BIASED · OVERTHINKING THE FINISH</p>
    <h1>One fan. Too many opinions.</h1>
    <p class="lede">Loose notes on great matches, strange finishes, and whatever still bothers me after the bell.</p>
    <div class="button-row">
      <a class="button" href="shows.html">Browse all shows</a>
      <a class="button ghost" href="shows/${latestShow.slug}.html">Latest show</a>
      <a class="button ghost" href="archive.html">Post archive</a>
    </div>
  </section>
  <aside class="paper note-card taped">
    <p class="hand-label">Start with a show</p>
    <h2>One tape, many thoughts.</h2>
    <p>Open a show hub to read every note in viewing order, or use the post archive when you only want individual ramblings.</p>
    <a class="text-link" href="shows.html">Browse all shows →</a>
  </aside>
  <section class="show-window paper" aria-labelledby="latest-show-title">
    <div class="tv-bar"><span>PLAY ▶</span><span>SP</span><span>00:47:18</span></div>
    <div class="show-window-inner show-window-grid">
      <div>
        <p class="eyebrow">LATEST RECLINER NOTES // TAPE ${escapeHtml(String(latestShow.tape || '---'))}</p>
        <h2 id="latest-show-title">${escapeHtml(latestShow.title)}</h2>
        <p class="show-date">${longDate(latestShow.date)} · ${latestShow.posts.length} notes · ${escapeHtml(latestShow.format || '')}</p>
        <p>${escapeHtml(latestShow.summary)}</p>
        <div class="mini-track" aria-label="Notes in this show">
          ${latestShow.posts.map((post) => `<a href="posts/${post.slug}.html"><span>${padNote(post.note_number)}</span>${escapeHtml(post.title)}</a>`).join('')}
        </div>
        <div class="button-row compact-row"><a class="button small" href="shows/${latestShow.slug}.html">Enter this show window</a><a class="button small ghost dark-ghost" href="shows.html">All shows</a></div>
      </div>
      ${featureFigure(latestShowImg, '', 'compact-feature')}
    </div>
  </section>
  <section class="home-show-library paper" aria-labelledby="home-shows-title">
    <div class="directory-heading"><div><p class="eyebrow">THE TAPE LIBRARY</p><h2 id="home-shows-title">Recent shows</h2><p>Jump into a complete viewing log instead of digging through individual posts.</p></div><a class="button small" href="shows.html">Browse every show</a></div>
    <div class="home-show-grid">
      ${shows.slice(0, Number(config.shows_on_homepage || 3)).map(renderHomeShowCard).join('\n')}
    </div>
  </section>
  <section class="latest-stack">
    <div class="section-heading"><div><p class="eyebrow">LATEST INDIVIDUAL POSTS</p><h2>Fresh from the recliner</h2></div><a class="text-link" href="archive.html">Full post archive →</a></div>
    ${posts.slice(0, Number(config.posts_on_homepage || 3)).map(renderHomePost).join('\n')}
  </section>
  <aside class="paper recurring-card crooked-left">
    <p class="hand-label">Two ways to read</p>
    <dl>
      <div><dt>By show</dt><dd>Read the complete tape in viewing order.</dd></div>
      <div><dt>By post</dt><dd>Browse individual notes across every show.</dd></div>
    </dl>
    <a class="button small" href="shows.html">Open Shows</a>
  </aside>
</main>`;
write(path.join(ROOT, 'index.html'), documentPage({ title: 'Home', description: config.description, image: latestShowImg.src, bodyClass: 'home-page', activePage: 'home', content: homeContent }));

const showsContent = `<main id="main" class="shell single-column shows-directory-page">
  <header class="page-intro paper show-directory-intro"><p class="eyebrow">THE COMPLETE TAPE LIBRARY</p><h1>Shows</h1><p class="lede">Choose a show first, then read its notes in the order they happened. Every thought still remains available separately in the post archive.</p><div class="directory-actions"><a class="button" href="shows/${latestShow.slug}.html">Play latest tape</a><a class="button ghost" href="archive.html">Browse individual posts</a></div></header>
  <div class="directory-heading directory-heading-dark"><div><p class="eyebrow">${shows.length} RECORDED ${shows.length === 1 ? 'SHOW' : 'SHOWS'}</p><h2>All viewing logs</h2></div><p>Newest first. No hidden shelves.</p></div>
  <section class="show-directory" aria-label="All show viewing logs">
    ${shows.map((show, index) => {
      const img = imageData(show, null);
      const href = `shows/${show.slug}.html`;
      return `<article class="show-library-card paper">
        <div class="show-library-image">${cardImage(img).replace('#IMAGE_LINK#', href).replace('#IMAGE_LABEL#', `Open ${escapeHtml(show.title)}`)}${index === 0 ? '<span class="latest-tape-badge">LATEST</span>' : ''}</div>
        <div class="show-library-copy">
          <div class="cassette-label"><span>TAPE ${escapeHtml(String(show.tape || '---'))}</span><span>${show.posts.length} NOTES</span></div>
          <p class="post-meta">${longDate(show.date)} · ${escapeHtml(show.format || '')} · ${escapeHtml(show.promotion || 'Wrestling')}</p>
          <h2><a href="${href}">${escapeHtml(show.title)}</a></h2>
          <p>${escapeHtml(show.summary)}</p>
          ${show.posts.length ? `<div class="show-note-preview"><p class="eyebrow">INSIDE THIS TAPE</p>${show.posts.slice(0, 3).map((post) => `<a href="posts/${post.slug}.html"><span>${padNote(post.note_number)}</span>${escapeHtml(post.title)}</a>`).join('')}${show.posts.length > 3 ? `<a class="more-notes" href="${href}">+ ${show.posts.length - 3} more ${show.posts.length - 3 === 1 ? 'note' : 'notes'}</a>` : ''}</div>` : ''}
          <div class="show-card-footer"><div class="tag-row"><span>${escapeHtml(show.promotion || 'Wrestling')}</span><span>${show.posts.length} posts</span></div><a class="button small" href="${href}">Open show notes</a></div>
        </div>
      </article>`;
    }).join('\n')}
  </section>
</main>`;
write(path.join(ROOT, 'shows.html'), documentPage({ title: 'Shows', description: 'Browse every wrestling show hub and its complete collection of standalone commentary posts.', image: latestShowImg.src, bodyClass: 'shows-page', activePage: 'shows', content: showsContent }));

const types = [...new Set(posts.map((post) => post.type))];
const archiveContent = `<main id="main" class="shell single-column">
  <header class="page-intro paper crooked-left"><p class="eyebrow">EVERY TAKE, INCLUDING THE BAD ONES</p><h1>The Archive</h1><p class="lede">Each item below is a standalone post, even when it also belongs to a larger show window.</p></header>
  <section class="archive-tools paper" aria-label="Archive filters">
    <label for="archive-search">Search the pile</label><input id="archive-search" type="search" placeholder="Try: camera, finish, match…" data-archive-search>
    <div class="filter-row" role="group" aria-label="Filter archive by post type"><button class="filter-button active" type="button" data-filter="all">Everything</button>${types.map((type) => `<button class="filter-button" type="button" data-filter="${typeSlug(type)}">${escapeHtml(type)}</button>`).join('')}</div>
    <p class="archive-count" data-archive-count>Showing ${posts.length} posts</p>
  </section>
  <section class="archive-list" data-archive-list>
    ${posts.map((post) => {
      const show = showMap.get(post.show_slug);
      const d = dateParts(post.date);
      const img = imageData(post, show);
      const href = `posts/${post.slug}.html`;
      return `<article class="archive-card paper has-image" data-archive-card data-type="${typeSlug(post.type)}" data-show="${escapeHtml(show.slug)}">
        <div class="archive-date"><span>${d.day}</span><small>${monthShort[d.month-1]}<br>${d.year}</small></div>
        <div><p class="post-meta">${escapeHtml(post.type)} · ${escapeHtml(show.title)} · ${escapeHtml(post.read_time || '')}</p><h2><a href="${href}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.excerpt)}</p><div class="archive-links"><a class="text-link" href="${href}">Read post →</a><a class="subtle-link" href="shows/${show.slug}.html#note-${padNote(post.note_number)}">View inside show</a></div><span class="image-fallback-note">Image source: ${img.source}</span></div>
        ${cardImage(img).replace('#IMAGE_LINK#', href).replace('#IMAGE_LABEL#', `Read ${escapeHtml(post.title)}`)}
      </article>`;
    }).join('\n')}
    <p class="empty-state paper" data-empty-state hidden>No notes matched that search. The tape may have eaten them.</p>
  </section>
</main>`;
write(path.join(ROOT, 'archive.html'), documentPage({ title: 'Archive', description: 'Browse and filter every standalone post from Ringside Recliner.', image: latestShowImg.src, activePage: 'archive', content: archiveContent }));

const aboutContent = `<main id="main" class="shell article-layout">
  <article class="article paper">
    <p class="eyebrow">ABOUT THIS PILE OF TAPES</p><h1>Not an insider. Not a journalist. Just watching.</h1><p class="lede">${escapeHtml(config.site_name)} is an anonymous wrestling blog for observations that are too long for a group chat and too unserious for a press box.</p>
    <h2 id="format">The “blogs inside the blog” format</h2><p>Each show gets a <strong>Recliner Notes</strong> hub. Every segment thought, match note, rant, or verdict inside that hub also becomes its own standalone page.</p>
    <div class="format-diagram" aria-label="Diagram showing a show hub connected to standalone posts"><div class="diagram-hub">SHOW HUB<br><small>the full viewing log</small></div><div class="diagram-arrow">→</div><div class="diagram-posts"><span>01 Segment note</span><span>02 Match thought</span><span>03 Production gripe</span><span>04 Final verdict</span></div></div>
    <h2 id="images">Featured images</h2><p>A note first looks for its own featured image. Without one, it inherits the show's image. Without either, the Ringside Recliner default artwork appears. The image can be repositioned using the <code>image_position</code> field.</p>
    <h2>House rules</h2><ul class="rule-list"><li>No real names or personal details.</li><li>No pretending to have backstage information.</li><li>No ragebait disguised as analysis.</li><li>Changing your mind is allowed and old takes stay archived.</li><li>Kayfabe may be emotionally real.</li></ul>
    <h2>Who writes it?</h2><p>A person on a chair. That is all the biography this site needs.</p>
  </article>
  <aside class="article-aside"><div class="paper sticky-note"><p class="hand-label">Editorial position</p><p>Wrestling is at its best when it makes you feel clever for noticing something and foolish for caring this much.</p></div></aside>
</main>`;
write(path.join(ROOT, 'about.html'), documentPage({ title: 'About', description: config.description, image: config.default_featured_image, activePage: 'about', content: aboutContent }));

for (const show of shows) {
  const img = imageData(show, null);
  const showContent = `<main id="main" class="shell show-page-layout">
    <header class="show-hero paper crooked-left"><a class="back-link" href="../shows.html">← All show notes</a><div class="show-kicker"><span>RECLINER NOTES</span><span>TAPE ${escapeHtml(String(show.tape || '---'))}</span></div><h1>${escapeHtml(show.title)}</h1><p class="show-date">${longDate(show.date)} · ${escapeHtml(show.format || '')}</p>${featureFigure(img, '../')}<div class="lede">${markdownToHtml(show.body, { prefix: '../', sourcePath: show.sourcePath })}</div><div class="show-summary-grid"><div><strong>Best bit</strong><span>${escapeHtml(show.best_bit || '—')}</span></div><div><strong>Remote throw</strong><span>${escapeHtml(show.remote_throw || '—')}</span></div><div><strong>Final posture</strong><span>${escapeHtml(show.final_posture || '—')}</span></div></div></header>
    <nav class="tape-index paper" aria-label="Notes in this viewing log"><p class="hand-label">Jump around the tape</p>${show.posts.map((post) => `<a href="#note-${padNote(post.note_number)}"><span>${padNote(post.note_number)}</span>${escapeHtml(post.title)}</a>`).join('')}</nav>
    <section class="viewing-track" aria-label="Individual notes from this show"><div class="track-line" aria-hidden="true"></div>
      ${show.posts.map((post) => {
        const postImg = imageData(post, show);
        const href = `../posts/${post.slug}.html`;
        return `<article class="track-item paper has-image" id="note-${padNote(post.note_number)}"><div class="track-marker" aria-hidden="true"><span>${padNote(post.note_number)}</span></div><div class="track-content"><p class="post-meta">${escapeHtml(post.moment || '')} · ${escapeHtml(post.type)} · ${escapeHtml(post.read_time || '')}</p><h2><a href="${href}">${escapeHtml(post.title)}</a></h2><p>${escapeHtml(post.excerpt)}</p><div class="track-footer"><span class="rating">Recliner Rating: ${escapeHtml(post.rating || 'Not rated')}</span><a class="text-link" href="${href}">Open standalone post →</a></div><span class="image-fallback-note">Image source: ${postImg.source}</span></div>${cardImage(postImg, '../').replace('#IMAGE_LINK#', href).replace('#IMAGE_LABEL#', `Read ${escapeHtml(post.title)}`)}</article>`;
      }).join('\n')}
    </section>
    <aside class="paper end-of-tape"><p class="eyebrow">END OF TAPE</p><h2>The whole show in one sentence</h2><p>${escapeHtml(show.final_sentence || show.summary || '')}</p><a class="button small" href="../archive.html">See every standalone post</a></aside>
  </main>`;
  write(path.join(ROOT, 'shows', `${show.slug}.html`), documentPage({ title: `${show.title} — Recliner Notes`, description: show.summary, prefix: '../', image: img.src, activePage: 'shows', content: showContent }));
}

for (const show of shows) {
  show.posts.forEach((post, index) => {
    const img = imageData(post, show);
    const previous = show.posts[index - 1];
    const next = show.posts[index + 1];
    const tagList = Array.isArray(post.tags) ? post.tags : [];
    const postContent = `<main id="main" class="shell article-layout">
      <article class="article paper post-article"><a class="back-link" href="../shows/${show.slug}.html#note-${padNote(post.note_number)}">← Back to this show window</a><p class="eyebrow">NOTE ${padNote(post.note_number)} OF ${padNote(show.posts.length)} // ${escapeHtml(post.type)}</p><h1>${escapeHtml(post.title)}</h1><div class="byline-strip"><span>${escapeHtml(show.title)}</span><span>${longDate(post.date)}</span><span>${escapeHtml(post.read_time || '')}</span></div>${featureFigure(img, '../')}<p class="lede">${escapeHtml(post.excerpt)}</p><div class="content-body">${markdownToHtml(post.body, { prefix: '../', sourcePath: post.sourcePath })}</div><div class="rating-box"><span>RECLINER RATING</span><strong>${escapeHtml(post.rating || 'Not rated')}</strong></div><div class="tag-row"><a href="../shows/${show.slug}.html">${escapeHtml(show.title)}</a><span>${escapeHtml(post.type)}</span>${tagList.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="post-pager">${previous ? `<a href="${previous.slug}.html"><span>Previous note</span>${escapeHtml(previous.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="${next.slug}.html"><span>Next note</span>${escapeHtml(next.title)}</a>` : ''}</div></article>
      <aside class="article-aside"><div class="paper show-context taped"><p class="hand-label">Part of a larger tape</p><h2>${escapeHtml(show.title)}</h2><p>This post also appears as note ${padNote(post.note_number)} inside the complete viewing log.</p><a class="button small" href="../shows/${show.slug}.html">Open all ${show.posts.length} notes</a><span class="image-fallback-note">Featured image: ${img.source}</span></div></aside>
    </main>`;
    write(path.join(ROOT, 'posts', `${post.slug}.html`), documentPage({ title: post.title, description: post.excerpt, prefix: '../', bodyClass: 'post-page', image: img.src, activePage: 'archive', content: postContent }));
  });
}

const rssItems = posts.slice(0, 30).map((post) => {
  const show = showMap.get(post.show_slug);
  const link = config.site_url ? `${config.site_url.replace(/\/$/, '')}/posts/${post.slug}.html` : `posts/${post.slug}.html`;
  return `<item><title>${escapeHtml(post.title)}</title><link>${escapeHtml(link)}</link><guid>${escapeHtml(link)}</guid><pubDate>${rssDate(post.date)}</pubDate><description>${escapeHtml(`${post.excerpt} — ${show.title}`)}</description></item>`;
}).join('\n');
write(path.join(ROOT, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${escapeHtml(config.site_name)}</title><link>${escapeHtml(config.site_url || 'index.html')}</link><description>${escapeHtml(config.description)}</description>${rssItems}</channel></rss>`);

const sitemapPaths = ['index.html','shows.html','archive.html','about.html', ...shows.map((s) => `shows/${s.slug}.html`), ...posts.map((p) => `posts/${p.slug}.html`)];
write(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapPaths.map((p) => `<url><loc>${escapeHtml(config.site_url ? absoluteUrl(p) : p)}</loc></url>`).join('')}</urlset>`);

console.log(`Built ${shows.length} show hub(s) and ${posts.length} post page(s).`);
console.log('Featured image fallback: post → show → default.');
