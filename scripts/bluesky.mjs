import { isWebUrl, canonicalUrl } from './data.mjs';

const hashtagList = record => [...new Set([
  ...(record.facets ?? []).flatMap(facet => facet.features ?? []).filter(feature => feature.$type === 'app.bsky.richtext.facet#tag').map(feature => feature.tag.toLowerCase()),
  ...[...(record.text ?? '').matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)].map(match => match[1].toLowerCase()),
])];
const externalEmbed = post => post.embed?.external ?? post.embed?.media?.external ?? post.record?.embed?.external ?? post.record?.embed?.media?.external;
const cleanNote = (record, tags) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(record.text ?? '');
  const links = (record.facets ?? []).filter(facet => facet.features?.some(feature => feature.$type === 'app.bsky.richtext.facet#link'));
  // Facet indices are UTF-8 byte offsets, not JavaScript character offsets.
  const hidden = links.map(facet => facet.index).filter(index => Number.isInteger(index?.byteStart) && Number.isInteger(index?.byteEnd));
  const cleaned = decoder.decode(bytes.filter((_, index) => !hidden.some(range => index >= range.byteStart && index < range.byteEnd)));
  return cleaned.replace(/https?:\/\/\S+/g, '').replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (match, space, tag) => tags.includes(tag.toLowerCase()) ? space : match).replace(/\s+/g, ' ').trim();
};

export const entriesFromFeed = (feed, config, actorDid) => feed.flatMap(item => {
  const { post } = item;
  if (!post || item.reason || post.author?.did !== actorDid || post.record?.reply) return [];
  const record = post.record;
  if (!record || typeof record.text !== 'string' || Number.isNaN(Date.parse(record.createdAt))) return [];
  const tags = hashtagList(record);
  if (config.mode !== 'all-links' && !tags.includes(config.hashtag.toLowerCase())) return [];
  const external = externalEmbed(post);
  const facetLinks = (record.facets ?? []).flatMap(facet => facet.features ?? []).filter(feature => feature.$type === 'app.bsky.richtext.facet#link').map(feature => feature.uri);
  const links = [...new Set([external?.uri, ...facetLinks, ...(facetLinks.length ? [] : [...record.text.matchAll(/https?:\/\/[^\s<>]+/g)].map(match => match[0].replace(/[.,;!?)]+$/, '')))].filter(isWebUrl).map(canonicalUrl))];
  const categoryTags = Object.fromEntries(Object.entries(config.categoryTags).map(([key, value]) => [key.toLowerCase(), value]));
  const categoryTag = tags.find(tag => categoryTags[tag]);
  const note = cleanNote(record, tags);
  const rkey = post.uri?.split('/').at(-1);
  if (!rkey) return [];
  return links.filter(url => !config.excludeUrls.some(excluded => canonicalUrl(excluded) === url)).map(url => {
    const matchingEmbed = external?.uri && isWebUrl(external.uri) && canonicalUrl(external.uri) === url;
    const title = matchingEmbed && external.title?.trim() ? external.title.trim() : new URL(url).hostname.replace(/^www\./, '');
    return {
      title,
      url,
      category: categoryTags[categoryTag] ?? config.defaultCategory,
      ...(note ? { note } : matchingEmbed && external.description?.trim() ? { note: external.description.trim() } : {}),
      tags: tags.filter(tag => tag !== config.hashtag.toLowerCase() && !categoryTags[tag]),
      ...(matchingEmbed && isWebUrl(external.thumb) ? { thumbnail: external.thumb } : {}),
      added: record.createdAt.slice(0, 10),
      source: `https://bsky.app/profile/${actorDid}/post/${encodeURIComponent(rkey)}`,
    };
  });
});

export const collectFeed = async (actor, fetchJson) => {
  const profile = await fetchJson('app.bsky.actor.getProfile', { actor });
  if (typeof profile.did !== 'string' || !profile.did.startsWith('did:')) throw new Error('Bluesky returned an invalid profile');
  const pages = [];
  const seen = new Set();
  let cursor;
  for (let page = 0; page < 50; page += 1) {
    const response = await fetchJson('app.bsky.feed.getAuthorFeed', { actor: profile.did, limit: '100', filter: 'posts_no_replies', ...(cursor ? { cursor } : {}) });
    if (!Array.isArray(response.feed)) throw new Error('Bluesky returned an invalid feed');
    pages.push(...response.feed);
    if (!response.cursor) return { feed: pages, did: profile.did };
    if (seen.has(response.cursor)) throw new Error('Bluesky repeated a pagination cursor; existing links were kept');
    seen.add(response.cursor);
    cursor = response.cursor;
  }
  throw new Error('Feed exceeded 5,000 posts. Existing links were kept; increase the pagination limit to backfill more.');
};
