import { entryMedia, providerEmbed, isHls } from './media.mjs';
import { mentionSegments } from './mentions.mjs';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const e = escapeHtml;
const icons = {
  garden: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6"/>',
  feed: '<rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/>',
  masonry: '<rect x="3" y="3" width="7" height="11" rx="1.5"/><rect x="14" y="3" width="7" height="6" rx="1.5"/><rect x="3" y="18" width="7" height="3" rx="1"/><rect x="14" y="13" width="7" height="8" rx="1.5"/>',
  github: '<path fill="currentColor" stroke="none" d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.83 10.83 0 0 1 5.63 0c2.15-1.46 3.09-1.15 3.09-1.15.61 1.55.23 2.69.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z"/>',
  all: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>',
  talks: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  papers: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8 12h8M8 16h6"/>',
  essays: '<path d="m4 20 4-1L20 7a2.1 2.1 0 0 0-3-3L5 16zM14 7l3 3M4 20h16"/>',
  books: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15"/>',
  images: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  audio: '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  movies: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  'tv shows': '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 2 4 4 4-4"/>',
  links: '<path d="m10 13 4-4M8 16l-1 1a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0M16 8l1-1a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alphabet: '<path d="m3 15 4-10 4 10M5 11h4M14 5h7l-7 10h7M4 20h16"/>',
  arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name.toLowerCase()] ?? icons[{ videos: 'talks', notes: 'essays' }[name.toLowerCase()]] ?? icons.links}</svg>`;
const tagButton = tag => `<button type="button" class="tag" data-tag="${e(tag)}" aria-pressed="false">#${e(tag)}</button>`;
const dropdown = (id, label, options) => `<div class="dropdown ${id === 'category' ? 'format-filter' : 'sort'}" data-dropdown>
  <label class="sr-only" id="${id}-label" for="${id}">${e(label)}</label>
  <select id="${id}">${options.map(option => `<option value="${e(option.value)}" data-label="${e(option.label)}"${option.count === undefined ? '' : ` data-count="${option.count}"`}>${e(option.label)}${option.count === undefined ? '' : ` (${option.count})`}</option>`).join('')}</select>
  <button type="button" class="dropdown-trigger" id="${id}-trigger" role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="${id}-menu" aria-labelledby="${id}-label ${id}-value" hidden><span id="${id}-value" class="dropdown-value"></span><span class="dropdown-chevron">${icon('chevron')}</span></button>
  <div class="dropdown-menu" id="${id}-menu" role="listbox" aria-labelledby="${id}-label" hidden>${options.map((option, index) => `<div class="dropdown-option" id="${id}-option-${index}" role="option" aria-selected="false" data-value="${e(option.value)}"><span class="dropdown-option-icon">${icon(option.icon)}</span><span class="dropdown-option-label">${e(option.label)}</span>${option.count === undefined ? '' : `<span class="dropdown-count">${option.count}</span>`}<span class="dropdown-check">${icon('check')}</span></div>`).join('')}</div>
</div>`;
const domain = url => new URL(url).hostname.replace(/^www\./, '');
const externalLink = (url, label) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)} ${icon('arrow')}<span class="sr-only"> (opens in a new tab)</span></a>`;
const renderMedia = (media, entry, index) => {
  const label = media.alt || `${entry.title}${media.type === 'image' ? ` — image ${index + 1}` : ''}`;
  const dimensions = media.width && media.height ? `width="${media.width}" height="${media.height}"` : '';
  const source = entry.source ?? media.url;
  if (media.type === 'image') return `<figure class="media-panel media-photo"><a class="full-image" href="${e(media.url)}" target="_blank" rel="noopener noreferrer" aria-label="${e(`Open image: ${label}`)}"><img src="${e(media.url)}" alt="${e(label)}" ${dimensions} loading="lazy" decoding="async" referrerpolicy="no-referrer"></a><figcaption><span>Image${media.width && media.height ? ` · ${media.width} × ${media.height}` : ''}</span>${externalLink(media.url, 'View full size')}</figcaption></figure>`;
  if (media.type === 'audio') return `<figure class="media-panel media-audio"><div class="audio-heading"><span class="audio-symbol" aria-hidden="true">♫</span><div><span class="media-eyebrow">Listen</span><p>${e(entry.title)}</p></div></div><audio controls preload="none" src="${e(media.url)}" aria-label="${e(label)}"></audio><p class="media-error" role="status" hidden>Audio could not be loaded. Open the original below.</p><figcaption><span>Audio</span>${externalLink(media.url, 'Open audio')}</figcaption></figure>`;
  if (media.type === 'video') return `<figure class="media-panel media-video${media.loop ? ' media-loop' : ''}"><div class="video-stage" ${media.width && media.height ? `style="--media-ratio:${media.width}/${media.height}"` : ''}><video controls playsinline preload="none" ${dimensions} ${media.poster ? `poster="${e(media.poster)}"` : ''} ${media.loop ? 'loop muted' : ''} ${isHls(media.url) ? `data-hls="${e(media.url)}"` : ''} aria-label="${e(label)}"><source src="${e(media.url)}"${isHls(media.url) ? ' type="application/vnd.apple.mpegurl"' : ''}></video>${isHls(media.url) ? `<button type="button" class="video-activate" data-video-load hidden aria-label="${e(`Play ${entry.title}`)}"><span aria-hidden="true">▶</span><span>Play ${media.loop ? 'animation' : 'video'}</span></button>` : ''}</div><p class="media-error" role="status" hidden>Video could not be loaded. Open the original below.</p><figcaption><span>${media.loop ? 'Animation · loops silently' : 'Video'}</span>${externalLink(source, 'Open original')}</figcaption></figure>`;
  const provider = providerEmbed(media.url);
  if (!provider) return '';
  const audio = ['spotify', 'soundcloud'].includes(provider.type);
  return `<figure class="media-panel media-embed${audio ? ' media-embed-audio' : ''}"><iframe src="${e(provider.src)}" title="${e(`${provider.label}: ${entry.title}`)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption><span>${audio ? 'Listen' : 'Watch'} on ${e(provider.label)}</span>${externalLink(media.url, 'Open original')}</figcaption></figure>`;
};
const profileUrl = profile => `https://bsky.app/profile/${profile.did}`;
const avatar = (profile, className = '') => `<span class="avatar ${className}">${profile.avatar ? `<img src="${e(profile.avatar)}" alt="" width="96" height="96" loading="lazy">` : `<span aria-hidden="true">${e(profile.displayName.slice(0, 1).toUpperCase())}</span>`}</span>`;
const mentionLink = ({ text, href }) => `<a class="mention" href="${e(href)}" target="_blank" rel="noopener noreferrer">${e(text)}<span class="sr-only"> (opens in a new tab)</span></a>`;
const linkedMentions = (text, mentions) => mentionSegments(text, mentions).map(part => part.href ? mentionLink(part) : e(part.text)).join('');
const linkedText = text => text.split(/(https?:\/\/[^\s<>]+)/g).map(part => /^https?:\/\//.test(part) ? `<a href="${e(part)}" target="_blank" rel="noopener noreferrer">${e(part.replace(/^https?:\/\//, ''))}</a>` : linkedMentions(part)).join('');
const linkedTitle = entry => {
  const parts = mentionSegments(entry.title, entry.mentions);
  if (!parts.some(part => part.href)) return `<a href="${e(entry.url)}" target="_blank" rel="noopener noreferrer">${e(entry.title)}<span class="outbound">${icon('arrow')}<span class="sr-only"> (opens in a new tab)</span></span></a>`;
  // Keep account links separate from the title's resource link: anchors cannot nest.
  return parts.map(part => part.href ? mentionLink(part) : `<a href="${e(entry.url)}" target="_blank" rel="noopener noreferrer">${e(part.text)}<span class="sr-only"> (opens in a new tab)</span></a>`).join('')
    + `<a class="outbound" href="${e(entry.url)}" target="_blank" rel="noopener noreferrer" aria-label="${e(`Open linked resource: ${entry.title} (opens in a new tab)`)}">${icon('arrow')}</a>`;
};
const renderEntry = (entry, index) => {
  const media = entryMedia(entry);
  const linked = (entry.links ?? []).filter(link => !media.some(item => item.url === link.url));
  const rich = media.length > 0 || linked.length > 0;
  const titleRepeatsNote = entry.title.endsWith('…') && entry.note?.toLowerCase().startsWith(entry.title.slice(0, -1).toLowerCase());
  const date = entry.added ? new Date(`${entry.added}T12:00:00Z`) : null;
  const timestamp = date ? `<time class="entry-date" datetime="${e(entry.createdAt ?? entry.added)}" title="${e(date.toLocaleDateString('en', { dateStyle: 'long', timeZone: 'UTC' }))}">${e(date.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }))}</time>` : '';
  return `<li class="entry${rich ? ' entry-rich' : ''}${entry.category === 'Notes' ? ' entry-thought' : ''}" data-entry="${index}" data-category="${e(entry.category)}" data-tags="${e(JSON.stringify(entry.tags))}" data-added="${e(entry.createdAt ?? entry.added ?? '')}" data-title="${e(entry.title)}" data-search="${e([entry.title, entry.note, entry.category, entry.url, ...(entry.links ?? []).map(link => link.title), ...entry.tags].filter(Boolean).join(' ').toLowerCase())}">
  <article class="entry-body">
    ${titleRepeatsNote ? `<h3 class="sr-only">${e(entry.title)}</h3>` : `<h3>${linkedTitle(entry)}</h3>`}
    ${entry.note ? `<p class="entry-note">${linkedMentions(entry.note, entry.mentions)}</p>` : ''}
    ${media.length ? `<div class="entry-media${media.every(item => item.type === 'image') && media.length > 1 ? ' image-gallery' : ''}">${media.map((item, i) => renderMedia(item, entry, i)).join('')}</div>` : ''}
    ${linked.length ? `<div class="entry-links">${linked.map((link, i) => `<a class="link-preview" href="${e(link.url)}" target="_blank" rel="noopener noreferrer">${i === 0 && entry.thumbnail ? `<img src="${e(entry.thumbnail)}" alt="" width="72" height="72" loading="lazy">` : ''}<span><strong>${e(link.title)}</strong><small>${e(domain(link.url))}</small></span>${icon('arrow')}<span class="sr-only"> (opens in a new tab)</span></a>`).join('')}</div>` : ''}
    ${entry.tags.length ? `<div class="entry-tags">${entry.tags.map(tagButton).join('')}</div>` : ''}
    <div class="entry-bottom"><span class="entry-details"><span class="entry-format">${icon(entry.category)}${e(entry.category)}</span>${timestamp}</span><a class="source-link" href="${e(entry.source)}" target="_blank" rel="noopener noreferrer" aria-label="View post on Bluesky (opens in a new tab)">Bluesky ${icon('arrow')}</a></div>
  </article>
  ${entry.thumbnail && !rich ? `<div class="entry-image"><img src="${e(entry.thumbnail)}" alt="" width="88" height="88" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}
</li>`;
};

export const renderGarden = ({ profile, entries }, { assetVersion = '' } = {}) => {
  const assetQuery = assetVersion ? `?v=${encodeURIComponent(assetVersion)}` : '';
  const categories = [...new Set(entries.map(entry => entry.category))].sort((a, b) => a.localeCompare(b));
  const tags = [...new Set(entries.flatMap(entry => entry.tags))].sort((a, b) => a.localeCompare(b));
  const source = profileUrl(profile);
  const formats = [{ value: '', label: 'All posts', count: entries.length, icon: 'all' }, ...categories.map(category => ({ value: category, label: category, count: entries.filter(entry => entry.category === category).length, icon: category }))];
  const templateUrl = 'https://github.com/crs48/digitalgarden/generate';
  const description = `The digital garden of @${profile.handle}. Links, ideas, and discoveries collected on Bluesky with #garden.`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(profile.displayName)}’s garden · @${e(profile.handle)}</title>
  <meta name="description" content="${e(description)}">
  <meta property="og:title" content="${e(profile.displayName)}’s garden"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website">
  ${profile.avatar ? `<meta property="og:image" content="${e(profile.avatar)}">` : ''}
  <meta name="theme-color" content="#ffffff"><link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./styles.css${assetQuery}">
  <script src="./garden.js${assetQuery}" type="module"></script><script src="./media.js${assetQuery}" type="module"></script>
</head>
<body>
  <a class="skip-link" href="#collection">Skip to garden</a>
  <div class="shell">
    <main class="main-column">
      <header class="page-header"><div><a class="brand" href="./" aria-label="Digital garden home">${icon('garden')}<span>#garden</span></a><span class="header-count">${entries.length} ${entries.length === 1 ? 'post' : 'posts'} collected</span></div><a class="header-profile-link" href="${e(source)}" aria-label="Open @${e(profile.handle)} on Bluesky">${icon('arrow')}</a></header>
      <section class="profile-header" aria-labelledby="page-title">
        <div class="profile-banner">${profile.banner ? `<img src="${e(profile.banner)}" alt="" fetchpriority="high" width="1500" height="500">` : ''}</div>
        <div class="profile-info"><div class="profile-actions"><a class="profile-avatar" href="${e(source)}" aria-label="${e(profile.displayName)} on Bluesky">${avatar(profile)}</a><a class="profile-button" href="${e(source)}">View on Bluesky ${icon('arrow')}</a></div>
          <h1 id="page-title">${e(profile.displayName)}</h1><a class="profile-handle" href="${e(source)}">@${e(profile.handle)}</a>
          ${profile.description ? `<p class="profile-bio">${linkedText(profile.description)}</p>` : ''}
          <p class="garden-description">A garden of links, ideas, and discoveries.<br>Collected on Bluesky with <span>#garden</span>.</p>
        </div>
      </section>
      <div class="collection-toolbar" hidden>
        <div class="filter-strip" role="region" aria-label="Garden filters" tabindex="0">
          <div class="search" data-expanded="false"><button type="button" id="search-toggle" aria-label="Search garden" title="Search garden (/)" aria-expanded="false" aria-controls="search-field">${icon('search')}</button><div id="search-field" class="search-field" hidden><input id="search" type="search" placeholder="Search" aria-label="Search the collection" autocomplete="off"><button type="button" id="search-close" aria-label="Close search and clear query" title="Close search (Esc)">${icon('close')}</button></div></div>
          ${dropdown('category', 'Filter by format', formats)}
          <button type="button" id="clear-filters" hidden>Clear filters <span aria-hidden="true">×</span></button>
          ${tags.length ? `<div class="filter-tags" role="group" aria-label="Filter by topic">${tags.map(tagButton).join('')}</div>` : ''}
          ${dropdown('sort', 'Sort the collection', [{ value: 'newest', label: 'Newest first', icon: 'clock' }, { value: 'title', label: 'Title, A–Z', icon: 'alphabet' }])}
        </div>
        <div class="view-switch" role="group" aria-label="View layout"><button type="button" data-view="feed" aria-label="Feed view" title="Feed view" aria-pressed="false">${icon('feed')}</button><button type="button" data-view="masonry" aria-label="Compact masonry view" title="Compact masonry view" aria-pressed="true">${icon('masonry')}</button></div>
      </div>
      <section id="collection" class="collection" aria-labelledby="collection-title" tabindex="-1">
        <div class="collection-heading"><h2 id="collection-title">Garden <span class="result-count" role="status" aria-live="polite">${entries.length} ${entries.length === 1 ? 'post' : 'posts'}</span></h2></div>
        <ul class="entries" data-layout="masonry" role="list">${entries.map(renderEntry).join('')}</ul>
        <div class="empty-state" ${entries.length ? 'hidden' : ''}><span aria-hidden="true">${icon('garden')}</span><h3>${entries.length ? 'No posts found' : 'A little room to grow'}</h3><p>${entries.length ? 'Try another search or choose a different topic.' : 'Posts tagged #garden on Bluesky will appear here.'}</p><button type="button" class="empty-reset" ${entries.length ? '' : 'hidden'}>Show all posts</button></div>
      </section>
      <footer>Grown on Bluesky. A garden of your own.</footer>
    </main>
    <aside class="garden-sidebar" aria-label="About this garden">
      <section class="about-garden"><h2>Post it. Keep it.</h2><p>Add <strong>#garden</strong> to a Bluesky post to give it a home here. Your other hashtags become topics.</p></section>
      <p class="site-note">An independent garden, connected to Bluesky.<br><a href="https://github.com/crs48/digitalgarden">Open source</a></p>
    </aside>
  </div>
  <a class="garden-badge" href="${templateUrl}" aria-label="Create your own garden on GitHub">${icon('github')}<span>Create your own garden</span></a>
</body>
</html>`;
};
