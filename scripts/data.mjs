import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

export const isWebUrl = value => {
  try { return typeof value === 'string' && ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
};

export const canonicalUrl = value => {
  const url = new URL(value);
  [...url.searchParams.keys()].filter(key => /^utm_|^(fbclid|gclid)$/i.test(key)).forEach(key => url.searchParams.delete(key));
  url.searchParams.sort();
  return url.href.replace(/\/$/, '');
};

const text = value => typeof value === 'string' && value.trim().length > 0;
const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
const optionalText = (object, keys, path) => keys.forEach(key => {
  if (object[key] !== undefined && !text(object[key])) fail(`${path}.${key}`, 'must be a non-empty string');
});
const stringList = (value, path) => {
  if (!Array.isArray(value) || value.some(item => !text(item))) fail(path, 'must be a list of non-empty strings');
};
const allowedKeys = (object, keys, path) => Object.keys(object).forEach(key => {
  if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown field (check for a typo)');
});

export const validateEntry = (entry, path = 'entry') => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(path, 'must be an object');
  allowedKeys(entry, ['title', 'url', 'creator', 'category', 'year', 'note', 'tags', 'thumbnail', 'added', 'example', 'source'], path);
  if (!text(entry.title)) fail(`${path}.title`, 'is required');
  if (!isWebUrl(entry.url)) fail(`${path}.url`, 'must be a full http(s) URL');
  optionalText(entry, ['creator', 'category', 'note'], path);
  if (entry.tags !== undefined) stringList(entry.tags, `${path}.tags`);
  if (entry.year !== undefined && (!Number.isInteger(entry.year) || entry.year < 1 || entry.year > 9999)) fail(`${path}.year`, 'must be a year');
  if (entry.added !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.added) || Number.isNaN(Date.parse(entry.added)) || new Date(entry.added).toISOString().slice(0, 10) !== entry.added)) fail(`${path}.added`, 'use a valid YYYY-MM-DD date');
  if (entry.example !== undefined && typeof entry.example !== 'boolean') fail(`${path}.example`, 'must be true or false');
  if (entry.thumbnail !== undefined && !isWebUrl(entry.thumbnail) && !(typeof entry.thumbnail === 'string' && /^(?:\.\/)?images\/[\w./-]+$/.test(entry.thumbnail) && !entry.thumbnail.split('/').includes('..'))) fail(`${path}.thumbnail`, 'use an http(s) URL or images/filename');
  if (entry.source !== undefined && !isWebUrl(entry.source)) fail(`${path}.source`, 'must be a full http(s) URL');
  return { ...entry, category: entry.category ?? 'Links', tags: [...new Set(entry.tags ?? [])] };
};

export const validateConfig = config => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('garden.yaml', 'must be an object');
  allowedKeys(config, ['site', 'categories', 'bluesky', 'entries'], 'garden.yaml');
  const { site, bluesky = {} } = config;
  if (!site || typeof site !== 'object' || Array.isArray(site)) fail('site', 'is required');
  allowedKeys(site, ['title', 'owner', 'home', 'heading', 'description', 'accent', 'repository'], 'site');
  ['title', 'owner', 'heading', 'description'].forEach(key => { if (!text(site[key])) fail(`site.${key}`, 'is required'); });
  ['home', 'repository'].forEach(key => { if (site[key] !== undefined && !isWebUrl(site[key])) fail(`site.${key}`, 'must be a full http(s) URL'); });
  if (site.accent !== undefined && !/^#[\da-f]{6}$/i.test(site.accent)) fail('site.accent', 'use a six-digit hex color, e.g. #2458d3');
  if (config.categories !== undefined) stringList(config.categories, 'categories');
  if (!bluesky || typeof bluesky !== 'object' || Array.isArray(bluesky)) fail('bluesky', 'must be an object');
  allowedKeys(bluesky, ['enabled', 'handle', 'mode', 'hashtag', 'defaultCategory', 'categoryTags', 'excludeUrls'], 'bluesky');
  if (bluesky.enabled !== undefined && typeof bluesky.enabled !== 'boolean') fail('bluesky.enabled', 'must be true or false');
  if (bluesky.enabled && !text(bluesky.handle)) fail('bluesky.handle', 'is required when enabled');
  optionalText(bluesky, ['handle', 'hashtag', 'defaultCategory'], 'bluesky');
  if (bluesky.handle && !/^[a-z0-9.-]+$/i.test(bluesky.handle)) fail('bluesky.handle', 'use a handle such as your-name.bsky.social');
  if (bluesky.hashtag && !/^[\p{L}\p{N}_-]+$/u.test(bluesky.hashtag)) fail('bluesky.hashtag', 'use a tag without # or spaces');
  if (bluesky.mode !== undefined && !['hashtag', 'all-links', 'manual'].includes(bluesky.mode)) fail('bluesky.mode', 'use hashtag, all-links, or manual');
  if (bluesky.categoryTags !== undefined && (!bluesky.categoryTags || typeof bluesky.categoryTags !== 'object' || Array.isArray(bluesky.categoryTags) || Object.values(bluesky.categoryTags).some(value => !text(value)))) fail('bluesky.categoryTags', 'must map hashtags to category names');
  if (bluesky.excludeUrls !== undefined && (!Array.isArray(bluesky.excludeUrls) || bluesky.excludeUrls.some(url => !isWebUrl(url)))) fail('bluesky.excludeUrls', 'must be a list of http(s) URLs');
  if (!Array.isArray(config.entries)) fail('entries', 'must be a list; use [] for an empty garden');
  const entries = config.entries.map((entry, i) => validateEntry(entry, `entries[${i}]`));
  const urls = entries.map(entry => canonicalUrl(entry.url));
  if (new Set(urls).size !== urls.length) fail('entries', 'contains duplicate URLs');
  return { ...config, site: { accent: '#2458d3', ...site }, categories: config.categories ?? [], bluesky: { enabled: false, mode: 'hashtag', hashtag: 'garden', defaultCategory: 'Links', categoryTags: {}, excludeUrls: [], ...bluesky }, entries };
};

export const mergeEntries = (manual, imported, excludeUrls = []) => {
  const excluded = new Set(excludeUrls.map(canonicalUrl));
  const ordered = [...manual, ...imported].map(entry => [canonicalUrl(entry.url), entry]);
  const byUrl = new Map([...ordered].reverse());
  return [...new Set(ordered.map(([url]) => url))].filter(url => !excluded.has(url)).map(url => byUrl.get(url));
};

export const readConfig = async () => validateConfig(parse(await readFile('garden.yaml', 'utf8')));
export const readImported = async () => {
  const entries = JSON.parse(await readFile('content/bluesky.json', 'utf8'));
  if (!Array.isArray(entries)) fail('content/bluesky.json', 'must be an array');
  return entries.map((entry, i) => validateEntry(entry, `content/bluesky.json[${i}]`));
};
