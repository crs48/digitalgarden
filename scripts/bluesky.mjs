import { isWebUrl, canonicalUrl } from './data.mjs';
import { inferMedia } from './media.mjs';

const hashtagList = record => [...new Set([
  ...(record.facets ?? []).flatMap(facet => facet.features ?? []).filter(feature => feature.$type === 'app.bsky.richtext.facet#tag').map(feature => feature.tag.toLowerCase()),
  ...[...(record.text ?? '').replace(/https?:\/\/\S+/g, '').matchAll(/(?:^|[^\p{L}\p{N}_/])#([\p{L}\p{N}_-]+)/gu)].map(match => match[1].toLowerCase()),
])];
const externalEmbed = post => post.embed?.external ?? post.embed?.media?.external ?? post.record?.embed?.external ?? post.record?.embed?.media?.external;
const cleanCopy = (record, tags) => {
  const bytes = new TextEncoder().encode(record.text ?? '');
  // Facet indices are UTF-8 byte offsets, not JavaScript character offsets.
  const hidden = (record.facets ?? []).filter(facet => facet.features?.some(feature => ['app.bsky.richtext.facet#link', 'app.bsky.richtext.facet#tag'].includes(feature.$type)))
    .map(facet => facet.index).filter(index => Number.isInteger(index?.byteStart) && Number.isInteger(index?.byteEnd));
  return new TextDecoder().decode(bytes.filter((_, index) => !hidden.some(range => index >= range.byteStart && index < range.byteEnd)))
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_-]+)/gu, (match, prefix, tag) => tags.includes(tag.toLowerCase()) ? prefix : match)
    .split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
const truncate = (text, length = 88) => {
  if (text.length <= length) return text;
  const prefix = text.slice(0, length - 1);
  return `${prefix.replace(/\s+\S*$/, '') || prefix}…`;
};
const capitalize = text => text.replace(/^\p{L}/u, first => first.toUpperCase());

export const titleFromCopy = (copy, fallback) => {
  if (!copy) return { title: truncate(fallback), note: '' };
  const firstLine = copy.split('\n')[0].replace(/^#{1,6}\s+/, '').trim();
  const sentence = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(firstLine)][0]?.segment.trim() ?? firstLine;
  const opening = copy.includes('\n') && firstLine.length <= 88 ? firstLine : sentence;
  const title = capitalize(truncate(opening));
  // Preserve the full copy when a long sentence must be shortened.
  const note = opening.length > 88 ? copy : copy.slice(copy.indexOf(opening) + opening.length).trim();
  return { title, note };
};
const attachedMedia = post => {
  const view = post.embed?.media ?? post.embed;
  if (!view) return [];
  if (Array.isArray(view.images)) return view.images.filter(image => isWebUrl(image.fullsize)).map(image => ({
    type: 'image', url: image.fullsize, alt: image.alt ?? '',
    ...(image.aspectRatio ? { width: image.aspectRatio.width, height: image.aspectRatio.height } : {}),
  }));
  if (isWebUrl(view.playlist)) return [{
    type: 'video', url: view.playlist,
    ...(isWebUrl(view.thumbnail) ? { poster: view.thumbnail } : {}),
    ...(view.aspectRatio ? { width: view.aspectRatio.width, height: view.aspectRatio.height } : {}),
    ...(view.alt ? { alt: view.alt } : {}),
    ...(view.presentation === 'gif' || post.record?.embed?.presentation === 'gif' ? { loop: true } : {}),
  }];
  return [];
};

export const entriesFromFeed = (feed, config, actorDid) => feed.flatMap(item => {
  const { post } = item;
  if (!post || item.reason || post.author?.did !== actorDid) return [];
  const record = post.record;
  if (!record || typeof record.text !== 'string' || Number.isNaN(Date.parse(record.createdAt))) return [];
  const tags = hashtagList(record);
  const marked = tags.includes(config.hashtag.toLowerCase());
  if (config.mode !== 'all-links' && !marked) return [];
  if (record.reply && !marked) return [];
  const rkey = post.uri?.split('/').at(-1);
  if (!rkey) return [];
  const source = `https://bsky.app/profile/${actorDid}/post/${encodeURIComponent(rkey)}`;
  const external = externalEmbed(post);
  const facetLinks = (record.facets ?? []).flatMap(facet => facet.features ?? []).filter(feature => feature.$type === 'app.bsky.richtext.facet#link').map(feature => feature.uri);
  const rawLinks = [...record.text.matchAll(/https?:\/\/[^\s<>]+/g)].map(match => match[0].replace(/[.,;!?)]+$/, ''));
  const urls = [...new Set([external?.uri, ...facetLinks, ...(facetLinks.length ? [] : rawLinks)].filter(isWebUrl).map(canonicalUrl))];
  const excluded = new Set(config.excludeUrls.map(canonicalUrl));
  if (excluded.has(canonicalUrl(source))) return [];
  const links = urls.filter(url => !excluded.has(canonicalUrl(url))).map(url => ({
    url,
    title: external?.uri && isWebUrl(external.uri) && canonicalUrl(external.uri) === url && external.title?.trim() ? external.title.trim() : new URL(url).hostname.replace(/^www\./, ''),
  }));
  if (urls.length && !links.length) return [];
  if (config.mode === 'all-links' && !marked && !links.length) return [];
  const media = [...attachedMedia(post), ...links.map(link => inferMedia(link.url)).filter(Boolean)];
  const primary = links[0];
  const fallback = external?.title?.trim() || (media.some(item => item.type === 'image') ? 'An image worth keeping' : media.length ? 'Something worth playing' : 'A thought worth keeping');
  const { title, note } = titleFromCopy(cleanCopy(record, tags), fallback);
  const categoryTags = Object.fromEntries(Object.entries(config.categoryTags).map(([key, value]) => [key.toLowerCase(), value]));
  const categoryTag = tags.find(tag => Object.hasOwn(categoryTags, tag));
  const format = media.some(item => ['youtube', 'vimeo', 'video'].includes(item.type)) ? 'Videos'
    : media.some(item => ['audio', 'spotify', 'soundcloud'].includes(item.type)) ? 'Audio'
      : media.some(item => item.type === 'image') ? 'Images' : !links.length ? 'Notes' : config.defaultCategory;
  return [{
    title, url: primary?.url ?? source,
    category: categoryTag ? categoryTags[categoryTag] : format,
    ...(note ? { note } : {}),
    tags: tags.filter(tag => tag !== config.hashtag.toLowerCase()),
    ...(isWebUrl(external?.thumb) ? { thumbnail: external.thumb } : {}),
    ...(links.length ? { links } : {}),
    ...(media.length ? { media } : {}),
    added: new Date(record.createdAt).toISOString().slice(0, 10), source,
  }];
});

export const collectFeed = async (actor, fetchJson) => {
  const profile = await fetchJson('app.bsky.actor.getProfile', { actor });
  if (typeof profile.did !== 'string' || !profile.did.startsWith('did:')) throw new Error('Bluesky returned an invalid profile');
  const pages = [];
  const seen = new Set();
  let cursor;
  for (let page = 0; page < 50; page += 1) {
    const response = await fetchJson('app.bsky.feed.getAuthorFeed', { actor: profile.did, limit: '100', filter: 'posts_with_replies', ...(cursor ? { cursor } : {}) });
    if (!Array.isArray(response.feed)) throw new Error('Bluesky returned an invalid feed');
    pages.push(...response.feed);
    if (!response.cursor) return { feed: pages, did: profile.did };
    if (seen.has(response.cursor)) throw new Error('Bluesky repeated a pagination cursor; existing entries were kept');
    seen.add(response.cursor);
    cursor = response.cursor;
  }
  throw new Error('Feed exceeded 5,000 posts. Existing entries were kept; increase the pagination limit to backfill more.');
};
