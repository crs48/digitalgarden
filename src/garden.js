const list = document.querySelector('.entries');
const entries = [...document.querySelectorAll('[data-entry]')];
const search = document.querySelector('#search');
const sort = document.querySelector('#sort');
const count = document.querySelector('.result-count');
const heading = document.querySelector('#collection-title');
const clear = document.querySelector('#clear-filters');
const active = document.querySelector('#active-filters');
const empty = document.querySelector('.empty-state');
const categoryButtons = [...document.querySelectorAll('[data-category-filter]')];
const tagButtons = [...document.querySelectorAll('[data-tag]')];
const knownCategories = new Set(categoryButtons.map(button => button.dataset.categoryFilter));
const knownTags = new Set(tagButtons.map(button => button.dataset.tag));
const topics = [...document.querySelectorAll('.topics')];
const mobile = matchMedia('(max-width: 680px)');
topics.forEach(topic => {
  topic.open = !mobile.matches;
  mobile.addEventListener('change', event => { topic.open = !event.matches; });
});
const readState = () => {
  const params = new URLSearchParams(location.search);
  return {
    category: knownCategories.has(params.get('category')) ? params.get('category') : '',
    tags: [...new Set(params.getAll('tag'))].filter(tag => knownTags.has(tag)),
    query: params.get('q') ?? '',
    sort: params.get('sort') === 'title' ? 'title' : 'newest',
  };
};
let state = readState();
const matches = (entry, current) => {
  const tags = JSON.parse(entry.dataset.tags);
  return (!current.category || entry.dataset.category === current.category)
    && current.tags.every(tag => tags.includes(tag))
    && current.query.toLowerCase().trim().split(/\s+/).every(word => entry.dataset.search.includes(word));
};
const compare = (a, b) => state.sort === 'title' ? a.dataset.title.localeCompare(b.dataset.title)
  : b.dataset.added.localeCompare(a.dataset.added) || Number(a.dataset.entry) - Number(b.dataset.entry);

const update = (writeUrl = true) => {
  const sorted = [...entries].sort(compare);
  sorted.forEach(entry => { entry.hidden = !matches(entry, state); });
  if ([...list.children].some((entry, index) => entry !== sorted[index])) list.replaceChildren(...sorted);
  const visible = entries.filter(entry => !entry.hidden).length;
  count.textContent = `${visible} ${visible === 1 ? 'post' : 'posts'}`;
  heading.firstChild.textContent = `${state.category || 'Garden'} `;
  empty.hidden = visible > 0;
  clear.hidden = !state.category && !state.tags.length && !state.query;
  categoryButtons.forEach(button => {
    const selected = button.dataset.categoryFilter === state.category;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.category-count').textContent = String(entries.filter(entry => matches(entry, { ...state, category: button.dataset.categoryFilter })).length);
  });
  tagButtons.forEach(button => button.setAttribute('aria-pressed', String(state.tags.includes(button.dataset.tag))));
  active.replaceChildren(...state.tags.map(tag => {
    const button = document.createElement('button');
    button.className = 'active-tag';
    button.textContent = `#${tag} ×`;
    button.setAttribute('aria-label', `Remove ${tag.replaceAll('-', ' ')} filter`);
    button.addEventListener('click', () => { state = { ...state, tags: state.tags.filter(value => value !== tag) }; update(); });
    return button;
  }));
  active.hidden = state.tags.length === 0;
  document.dispatchEvent(new Event('garden:filter'));
  if (writeUrl) {
    const url = new URL(location.href);
    ['category', 'tag', 'q', 'sort'].forEach(key => url.searchParams.delete(key));
    if (state.category) url.searchParams.set('category', state.category);
    state.tags.forEach(tag => url.searchParams.append('tag', tag));
    if (state.query) url.searchParams.set('q', state.query);
    if (state.sort !== 'newest') url.searchParams.set('sort', state.sort);
    history.replaceState(null, '', url);
  }
};
const reset = () => { state = { category: '', tags: [], query: '', sort: 'newest' }; search.value = ''; sort.value = 'newest'; update(); };
categoryButtons.forEach(button => button.addEventListener('click', () => { state = { ...state, category: button.dataset.categoryFilter }; update(); }));
tagButtons.forEach(button => button.addEventListener('click', () => {
  const tag = button.dataset.tag;
  state = { ...state, tags: state.tags.includes(tag) ? state.tags.filter(value => value !== tag) : [...state.tags, tag] };
  update();
}));
search.addEventListener('input', () => { state = { ...state, query: search.value }; update(); });
sort.addEventListener('change', () => { state = { ...state, sort: sort.value }; update(); });
clear.addEventListener('click', reset);
document.querySelector('.empty-reset').addEventListener('click', reset);
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest('input, textarea, select, [contenteditable]')) { event.preventDefault(); search.focus(); }
  if (event.key === 'Escape' && event.target === search) { search.value = ''; state = { ...state, query: '' }; update(); search.blur(); }
});
window.addEventListener('popstate', () => { state = readState(); search.value = state.query; sort.value = state.sort; update(false); });
document.querySelectorAll('.entry-image img').forEach(img => {
  const hideBroken = () => { img.closest('.entry-image').hidden = true; };
  img.addEventListener('error', hideBroken);
  if (img.complete && !img.naturalWidth) hideBroken();
});
search.value = state.query;
sort.value = state.sort;
document.querySelector('.filters').hidden = false;
document.querySelector('.categories').hidden = false;
document.querySelector('.mobile-topics').hidden = false;
document.querySelector('.collection-tools').hidden = false;
update(false);
