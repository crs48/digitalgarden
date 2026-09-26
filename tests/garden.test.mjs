import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, validateConfig, validateEntry, mergeEntries } from '../scripts/data.mjs';
import { renderGarden } from '../scripts/render.mjs';
import { entriesFromFeed, collectFeed } from '../scripts/bluesky.mjs';

const minimal = () => ({ site: { title: 'Garden', owner: 'Someone', heading: 'Worth keeping', description: 'A personal collection.' }, entries: [] });
const link = (overrides = {}) => ({ title: 'A resource', url: 'https://example.com/resource', ...overrides });
const config = () => validateConfig({ ...minimal(), bluesky: { enabled: true, handle: 'example.bsky.social', hashtag: 'garden', categoryTags: { paper: 'Papers' } } }).bluesky;
const did = 'did:plc:example';
const feedItem = (overrides = {}) => ({ post: { uri: `at://${did}/app.bsky.feed.post/abc`, author: { did }, record: { text: 'A useful idea #garden #paper #distributed-data', createdAt: '2026-09-25T12:00:00.000Z' }, embed: { external: { uri: 'https://example.com/paper', title: 'A good paper', description: 'A description', thumb: 'https://example.com/cover.png' } }, ...overrides } });

test('minimal entries and arbitrary categories are supported', () => {
  const validated = validateConfig({ ...minimal(), entries: [link({ category: 'Podcasts', tags: ['body', 'body'] })] });
  assert.equal(validated.entries[0].category, 'Podcasts');
  assert.deepEqual(validated.entries[0].tags, ['body']);
  assert.equal(validateEntry(link()).category, 'Links');
});
test('configuration typos fail with actionable paths', () => {
  assert.throws(() => validateConfig({ ...minimal(), entires: [] }), /garden.yaml.entires: unknown/);
  assert.throws(() => validateConfig({ ...minimal(), entries: [link({ thumnail: 'x' })] }), /entries\[0\].thumnail/);
});
test('unsafe links, images, dates, and injected colors are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//example.com']) assert.throws(() => validateEntry(link({ url })), /url/);
  for (const thumbnail of ['javascript:alert(1)', 'images/../../secret', '//tracking.example/pixel']) assert.throws(() => validateEntry(link({ thumbnail })), /thumbnail/);
  for (const added of ['2026-02-30', 'yesterday', '2026-9-2']) assert.throws(() => validateEntry(link({ added })), /added/);
  assert.throws(() => validateConfig({ ...minimal(), site: { ...minimal().site, accent: '#000000}</style>' } }), /accent/);
});
test('canonical links remove tracking but preserve content identity', () => {
  assert.equal(canonicalUrl('https://example.com/a/?utm_source=b&a=1&fbclid=x#section'), 'https://example.com/a/?a=1#section');
  assert.notEqual(canonicalUrl('https://example.com/?id=1'), canonicalUrl('https://example.com/?id=2'));
  assert.notEqual(canonicalUrl('https://example.com/#one'), canonicalUrl('https://example.com/#two'));
});
test('curated links keep their order and override imports without duplicates', () => {
  const manual = [link({ title: 'First', url: 'https://example.com/first' }), link({ title: 'Edited title' })];
  const imported = [link({ title: 'Imported title', url: 'https://example.com/resource?utm_source=bsky' }), link({ url: 'https://example.com/another' })];
  assert.deepEqual(mergeEntries(manual, imported).map(entry => entry.title), ['First', 'Edited title', 'A resource']);
  assert.equal(mergeEntries(manual, imported, ['https://example.com/resource']).length, 2);
});
test('HTML escapes author content and keeps relative GitHub Pages asset paths', () => {
  const html = renderGarden(validateConfig(minimal()), [validateEntry(link({ title: '<script>alert(1)</script>', note: '"quoted" & <text>', tags: ['</button>'] }))]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="\.\/styles.css"/);
  assert.match(html, /src="\.\/garden.js"/);
  assert.match(html, /rel="noopener noreferrer"/);
});
test('empty gardens render a real empty state', () => {
  const html = renderGarden(validateConfig(minimal()), []);
  assert.match(html, /Every garden starts somewhere/);
  assert.ok(!html.includes('Starter collection'));
});
test('Bluesky imports metadata, category, tags, notes, and provenance', () => {
  const [entry] = entriesFromFeed([feedItem()], config(), did);
  assert.equal(entry.title, 'A useful idea');
  assert.equal(entry.category, 'Papers');
  assert.deepEqual(entry.tags, ['paper', 'distributed-data']);
  assert.equal(entry.note, undefined);
  assert.equal(entry.links[0].title, 'A good paper');
  assert.equal(entry.added, '2026-09-25');
  assert.equal(entry.thumbnail, 'https://example.com/cover.png');
  assert.equal(entry.source, `https://bsky.app/profile/${did}/post/abc`);
});
test('only explicitly marked original posts are included by default', () => {
  const original = feedItem();
  const items = [
    { ...original, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } },
    feedItem({ author: { did: 'did:plc:someone-else' } }),
    feedItem({ record: { ...original.post.record, text: 'An unmarked reply', reply: {} } }),
    feedItem({ record: { ...original.post.record, text: '#gardening is different' } }),
  ];
  assert.deepEqual(entriesFromFeed(items, config(), did), []);
  assert.equal(entriesFromFeed([items[3]], { ...config(), mode: 'all-links' }, did).length, 1);
});
test('link facets respect UTF-8 offsets and multiple links', () => {
  const text = '🌱 café https://a.test/one and https://b.test/two #garden';
  const facet = url => ({ index: { byteStart: Buffer.byteLength(text.slice(0, text.indexOf(url))), byteEnd: Buffer.byteLength(text.slice(0, text.indexOf(url) + url.length)) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }] });
  const item = feedItem({ embed: undefined, record: { text, createdAt: '2026-09-25T00:00:00Z', facets: [facet('https://a.test/one'), facet('https://b.test/two')] } });
  const entries = entriesFromFeed([item], config(), did);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].links.length, 2);
  assert.equal(entries[0].title, '🌱 café and');
  assert.equal(entries[0].links[0].title, 'a.test');
});
test('record-with-media embeds and case-insensitive tags work', () => {
  const original = feedItem();
  const item = feedItem({ record: { ...original.post.record, text: 'Something #Garden #Paper' }, embed: { media: original.post.embed } });
  assert.equal(entriesFromFeed([item], config(), did)[0].category, 'Papers');
});
test('excluded links and invalid dates cannot enter the archive', () => {
  assert.deepEqual(entriesFromFeed([feedItem()], { ...config(), excludeUrls: ['https://example.com/paper?utm_source=abc'] }, did), []);
  assert.deepEqual(entriesFromFeed([feedItem({ record: { text: '#garden https://a.test', createdAt: 'bad' } })], config(), did), []);
});
test('pagination follows all pages using the resolved DID', async () => {
  const calls = [];
  const result = await collectFeed('example.bsky.social', async (method, params) => {
    calls.push({ method, params });
    if (method.endsWith('getProfile')) return { did };
    return params.cursor ? { feed: [feedItem()] } : { feed: [feedItem()], cursor: 'page2' };
  });
  assert.equal(result.feed.length, 2);
  assert.equal(calls[1].params.actor, did);
  assert.equal(calls[2].params.cursor, 'page2');
});
test('pagination and API failures stop before replacing saved content', async () => {
  await assert.rejects(collectFeed('example.bsky.social', async method => method.endsWith('getProfile') ? { did } : { feed: [], cursor: 'repeated' }), /repeated/);
  await assert.rejects(collectFeed('example.bsky.social', async method => method.endsWith('getProfile') ? { did } : { error: 'unavailable' }), /invalid feed/);
});
