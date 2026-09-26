export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const e = escapeHtml;
const icons = {
  all: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
  talks: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  papers: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8 12h8M8 16h6"/>',
  essays: '<path d="m4 20 4-1L20 7a2.1 2.1 0 0 0-3-3L5 16zM14 7l3 3M4 20h16"/>',
  books: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15"/>',
  movies: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  'tv shows': '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 2 4 4 4-4"/>',
  links: '<path d="m10 13 4-4M8 16l-1 1a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0M16 8l1-1a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name.toLowerCase()] ?? icons.links}</svg>`;
const tagButton = tag => `<button type="button" class="tag" data-tag="${e(tag)}" aria-pressed="false">${e(tag.replaceAll('-', ' '))}</button>`;
const domain = url => new URL(url).hostname.replace(/^www\./, '');
const renderEntry = (entry, index) => `<li class="entry" data-entry="${index}" data-category="${e(entry.category)}" data-tags="${e(JSON.stringify(entry.tags))}" data-added="${e(entry.added ?? '')}" data-title="${e(entry.title)}" data-search="${e([entry.title, entry.creator, entry.note, entry.category, entry.url, ...entry.tags].filter(Boolean).join(' ').toLowerCase())}">
  <span class="entry-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
  <article class="entry-body">
    <div class="entry-meta"><span>${e(entry.category)}</span>${entry.creator ? `<span>${e(entry.creator)}</span>` : ''}${entry.year ? `<span>${entry.year}</span>` : ''}</div>
    <h3><a href="${e(entry.url)}" target="_blank" rel="noopener noreferrer">${e(entry.title)}<span class="outbound">${icon('arrow')}<span class="sr-only"> (opens in a new tab)</span></span></a></h3>
    ${entry.note ? `<p class="entry-note">${e(entry.note)}</p>` : ''}
    <div class="entry-bottom"><div class="entry-tags">${entry.tags.map(tagButton).join('')}</div><span class="entry-domain">${e(domain(entry.url))}</span>${entry.source ? `<a class="source-link" href="${e(entry.source)}" target="_blank" rel="noopener noreferrer">via Bluesky<span class="sr-only"> (opens in a new tab)</span></a>` : ''}</div>
  </article>
  ${entry.thumbnail ? `<div class="entry-image"><img src="${e(entry.thumbnail)}" alt="" width="88" height="88" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}
</li>`;

export const renderGarden = (config, entries) => {
  const { site, bluesky } = config;
  const categories = [...new Set([...config.categories, ...entries.map(entry => entry.category)])];
  const tags = [...new Set(entries.flatMap(entry => entry.tags))].sort((a, b) => a.localeCompare(b));
  const categoryButton = (category, label, count) => `<button class="category${category === '' ? ' selected' : ''}" type="button" data-category-filter="${e(category)}" aria-pressed="${category === ''}"><span>${icon(category || 'all')}${e(label)}</span><span class="category-count">${String(count).padStart(2, '0')}</span></button>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(site.title)} — ${e(site.owner)}</title>
  <meta name="description" content="${e(site.description)}">
  <meta property="og:title" content="${e(site.title)} — ${e(site.owner)}"><meta property="og:description" content="${e(site.description)}"><meta property="og:type" content="website">
  <meta name="theme-color" content="#ffffff"><link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./styles.css"><style>:root{--accent:${site.accent}}</style>
  <script src="./garden.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#collection">Skip to collection</a>
  <div class="shell">
    <header class="site-header"><a class="brand" href="./" aria-label="${e(site.title)} home"><span class="brand-mark" aria-hidden="true">✳</span><span>${e(site.owner.toLowerCase())}<span class="brand-divider">/</span><strong>${e(site.title.toLowerCase())}</strong></span></a>
      <nav class="header-links" aria-label="Elsewhere">${site.home ? `<a href="${e(site.home)}">About ${e(site.owner)} ${icon('arrow')}</a>` : ''}${bluesky.handle ? `<a href="https://bsky.app/profile/${e(bluesky.handle)}">Bluesky ${icon('arrow')}</a>` : ''}</nav>
    </header>
    <main>
      <section class="intro" aria-labelledby="page-title"><div><p class="eyebrow">A personal collection, always growing</p><h1 id="page-title">${e(site.heading)}</h1><p class="intro-description">${e(site.description)}</p></div><span class="intro-index" aria-hidden="true">INDEX<br><span>${String(entries.length).padStart(3, '0')}</span></span></section>
      <div class="garden-layout">
        <aside class="filters" aria-label="Filter collection" hidden>
          <div class="filter-section"><h2>Browse by format</h2><div class="categories">${categoryButton('', 'Everything', entries.length)}${categories.map(category => categoryButton(category, category, entries.filter(entry => entry.category === category).length)).join('')}</div></div>
          ${tags.length ? `<div class="filter-section topics"><h2>Follow a thread</h2><div class="topic-tags">${tags.map(tagButton).join('')}</div><p class="filter-hint">Choose a topic. See where it leads.</p></div>` : ''}
          <div class="sidebar-note"><span aria-hidden="true">↳</span><p>A garden is never finished.<br>Neither is this one.</p></div>
        </aside>
        <section id="collection" class="collection" aria-labelledby="collection-title" tabindex="-1">
          <div class="collection-tools" hidden><label class="search">${icon('search')}<input id="search" type="search" placeholder="Find something interesting…" aria-label="Search the collection" autocomplete="off"><kbd aria-hidden="true">/</kbd></label><label class="sort"><span class="sr-only">Sort the collection</span><select id="sort"><option value="curated">Collection order</option><option value="newest">Newest additions</option><option value="title">Title, A–Z</option></select></label></div>
          <div class="collection-heading"><h2 id="collection-title">The collection <span class="result-count" role="status" aria-live="polite">${entries.length} ${entries.length === 1 ? 'item' : 'items'}</span></h2><button type="button" id="clear-filters" hidden>Clear filters <span aria-hidden="true">×</span></button></div>
          <div id="active-filters" class="active-filters" hidden></div>
          ${entries.some(entry => entry.example) ? '<p class="example-notice"><span>Starter collection</span> Example links to make your own.</p>' : ''}
          <ul class="entries">${entries.map(renderEntry).join('')}</ul>
          <div class="empty-state" ${entries.length ? 'hidden' : ''}><span aria-hidden="true">∅</span><h3>${entries.length ? 'A little room for discovery.' : 'Every garden starts somewhere.'}</h3><p>${entries.length ? 'No items match these filters. Try another word or follow a different thread.' : 'The first links will appear here soon.'}</p><button type="button" class="empty-reset" ${entries.length ? '' : 'hidden'}>Show everything</button></div>
        </section>
      </div>
    </main>
    <footer><p>A small corner of the internet, tended by ${e(site.owner)}.</p>${site.repository ? `<a href="${e(site.repository)}">Make a garden of your own ${icon('arrow')}</a>` : ''}</footer>
  </div>
</body>
</html>`;
};
