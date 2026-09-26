import { readFile } from 'node:fs/promises';
import { providerEmbed } from './media.mjs';

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
export const isDid = value => typeof value === 'string' && /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(value);
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
  allowedKeys(entry, ['title', 'url', 'category', 'note', 'tags', 'thumbnail', 'added', 'createdAt', 'source', 'media', 'links', 'mentions'], path);
  if (!text(entry.title)) fail(`${path}.title`, 'is required');
  if (!isWebUrl(entry.url)) fail(`${path}.url`, 'must be a full http(s) URL');
  optionalText(entry, ['category', 'note'], path);
  if (entry.tags !== undefined) stringList(entry.tags, `${path}.tags`);
  if (entry.added !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.added) || Number.isNaN(Date.parse(entry.added)) || new Date(entry.added).toISOString().slice(0, 10) !== entry.added)) fail(`${path}.added`, 'use a valid YYYY-MM-DD date');
  if (entry.createdAt !== undefined && (typeof entry.createdAt !== 'string' || Number.isNaN(Date.parse(entry.createdAt)))) fail(`${path}.createdAt`, 'must be a valid timestamp');
  if (entry.thumbnail !== undefined && !isWebUrl(entry.thumbnail)) fail(`${path}.thumbnail`, 'must be a full http(s) URL');
  if (entry.source !== undefined && !isWebUrl(entry.source)) fail(`${path}.source`, 'must be a full http(s) URL');
  if (entry.mentions !== undefined) {
    if (!Array.isArray(entry.mentions)) fail(`${path}.mentions`, 'must be a list');
    entry.mentions.forEach((mention, i) => {
      const field = `${path}.mentions[${i}]`;
      if (!mention || typeof mention !== 'object' || Array.isArray(mention)) fail(field, 'must be an object');
      allowedKeys(mention, ['handle', 'did'], field);
      if (!isDid(mention.did)) fail(`${field}.did`, 'must be a Bluesky account DID');
      if (normalizeHandle(mention.handle) !== mention.handle) fail(`${field}.handle`, 'must be a normalized Bluesky handle');
    });
  }
  if (entry.links !== undefined) {
    if (!Array.isArray(entry.links)) fail(`${path}.links`, 'must be a list');
    entry.links.forEach((link, i) => {
      if (!link || typeof link !== 'object' || Array.isArray(link)) fail(`${path}.links[${i}]`, 'must be an object');
      allowedKeys(link, ['title', 'url'], `${path}.links[${i}]`);
      if (!text(link.title) || !isWebUrl(link.url)) fail(`${path}.links[${i}]`, 'requires a title and http(s) URL');
    });
  }
  if (entry.media !== undefined) {
    if (!Array.isArray(entry.media)) fail(`${path}.media`, 'must be a list');
    entry.media.forEach((media, i) => {
      const field = `${path}.media[${i}]`;
      if (!media || typeof media !== 'object' || Array.isArray(media)) fail(field, 'must be an object');
      allowedKeys(media, ['type', 'url', 'alt', 'poster', 'width', 'height', 'loop'], field);
      if (!['image', 'video', 'audio', 'youtube', 'vimeo', 'spotify', 'soundcloud'].includes(media.type)) fail(`${field}.type`, 'unsupported media type');
      if (!isWebUrl(media.url)) fail(`${field}.url`, 'must be a full http(s) URL');
      if (['youtube', 'vimeo', 'spotify', 'soundcloud'].includes(media.type) && providerEmbed(media.url)?.type !== media.type) fail(`${field}.url`, 'must match the specified media provider');
      if (media.alt !== undefined && typeof media.alt !== 'string') fail(`${field}.alt`, 'must be text');
      if (media.poster !== undefined && !isWebUrl(media.poster)) fail(`${field}.poster`, 'must be a full http(s) URL');
      ['width', 'height'].forEach(key => { if (media[key] !== undefined && (!Number.isInteger(media[key]) || media[key] < 1 || media[key] > 100000)) fail(`${field}.${key}`, 'must be a positive pixel dimension'); });
      if (media.loop !== undefined && typeof media.loop !== 'boolean') fail(`${field}.loop`, 'must be true or false');
    });
  }
  return { ...entry, category: entry.category ?? 'Links', tags: [...new Set(entry.tags ?? [])] };
};

export const normalizeHandle = value => {
  const handle = typeof value === 'string' ? value.trim().replace(/^@/, '').toLowerCase() : '';
  if (!/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(handle)) fail('BLUESKY_HANDLE', 'use a Bluesky handle such as your-name.bsky.social');
  return handle;
};

export const validateProfile = profile => {
  if (!profile || !isDid(profile.did)) fail('profile.did', 'Bluesky returned an invalid profile');
  const handle = normalizeHandle(profile.handle);
  return {
    did: profile.did, handle,
    displayName: text(profile.displayName) ? profile.displayName.trim() : handle,
    description: typeof profile.description === 'string' ? profile.description : '',
    ...(isWebUrl(profile.avatar) ? { avatar: profile.avatar } : {}),
    ...(isWebUrl(profile.banner) ? { banner: profile.banner } : {}),
  };
};

export const validateGarden = (garden, expectedHandle) => {
  if (!garden || garden.version !== 1 || !Array.isArray(garden.entries)) fail('content/garden.json', 'expected a version 1 Bluesky snapshot');
  const profile = validateProfile(garden.profile);
  if (expectedHandle && normalizeHandle(expectedHandle) !== profile.handle) fail('content/garden.json', 'saved profile does not match BLUESKY_HANDLE; run npm run sync before building');
  const entries = garden.entries.map((entry, i) => {
    const value = validateEntry(entry, `entries[${i}]`);
    const prefix = `https://bsky.app/profile/${profile.did}/post/`;
    if (!value.source?.startsWith(prefix) || !/^[a-zA-Z0-9._~-]+$/.test(value.source.slice(prefix.length))) fail(`entries[${i}].source`, 'must be a post from the configured Bluesky profile');
    return value;
  });
  if (new Set(entries.map(entry => entry.source)).size !== entries.length) fail('entries', 'contains duplicate Bluesky posts');
  return { version: 1, profile, entries };
};

export const readGarden = async (filename = 'content/garden.json', expectedHandle = process.env.BLUESKY_HANDLE) => validateGarden(JSON.parse(await readFile(filename, 'utf8')), expectedHandle);
