const list = document.querySelector('.entries');
const entries = [...document.querySelectorAll('[data-entry]')];
const search = document.querySelector('#search');
const category = document.querySelector('#category');
const sort = document.querySelector('#sort');
const count = document.querySelector('.result-count');
const heading = document.querySelector('#collection-title');
const clear = document.querySelector('#clear-filters');
const empty = document.querySelector('.empty-state');
const categoryOptions = [...category.options];
const tagButtons = [...document.querySelectorAll('[data-tag]')];
const knownCategories = new Set(categoryOptions.map(option => option.value));
const knownTags = new Set(tagButtons.map(button => button.dataset.tag));
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
  categoryOptions.forEach(option => {
    const total = entries.filter(entry => matches(entry, { ...state, category: option.value })).length;
    option.textContent = `${option.dataset.label} (${total})`;
  });
  category.value = state.category;
  tagButtons.forEach(button => button.setAttribute('aria-pressed', String(state.tags.includes(button.dataset.tag))));
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
category.addEventListener('change', () => { state = { ...state, category: category.value }; update(); });
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
document.querySelector('.collection-toolbar').hidden = false;
update(false);
