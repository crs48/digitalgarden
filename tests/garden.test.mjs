import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, normalizeHandle, validateProfile, validateGarden, validateEntry } from '../scripts/data.mjs';
import { renderGarden } from '../scripts/render.mjs';
import { entriesFromFeed, collectFeed, gardenFromFeed } from '../scripts/bluesky.mjs';

const did = 'did:plc:example';
const profile = { did, handle: 'example.bsky.social', displayName: 'Someone', description: 'Things to keep.' };
const source = `https://bsky.app/profile/${did}/post/abc`;
const link = (overrides = {}) => ({ title: 'A resource', url: 'https://example.com/resource', source, ...overrides });
const snapshot = (entries = []) => ({ version: 1, profile, entries });
const feedItem = (overrides = {}) => ({ post: { uri: `at://${did}/app.bsky.feed.post/abc`, author: { did }, record: { text: 'A useful idea #garden #paper #distributed-data', createdAt: '2026-09-25T12:00:00.000Z' }, embed: { external: { uri: 'https://example.com/paper', title: 'A good paper', description: 'A description', thumb: 'https://example.com/cover.png' } }, ...overrides } });

test('handles accept an optional @ and reject URLs and malformed hosts', () => {
  assert.equal(normalizeHandle(' @Example.BSKY.social '), profile.handle);
  for (const value of ['', 'https://bsky.app/profile/test', 'bad handle', '-bad.test', 'test..social', 'just-a-name']) assert.throws(() => normalizeHandle(value), /BLUESKY_HANDLE/);
});
test('profiles use public identity and safely fall back for missing profile fields', () => {
  assert.deepEqual(validateProfile({ did, handle: profile.handle, avatar: 'javascript:alert(1)', viewer: { following: 'secret' } }), { did, handle: profile.handle, displayName: profile.handle, description: '' });
  assert.throws(() => validateProfile({ handle: profile.handle }), /invalid profile/);
});
test('a snapshot cannot publish another account or manually sourced entries', () => {
  assert.throws(() => validateGarden(snapshot(), 'another.bsky.social'), /does not match/);
  assert.throws(() => validateGarden(snapshot([link({ source: undefined })])), /source/);
  assert.throws(() => validateGarden(snapshot([link({ source: 'https://bsky.app/profile/did:plc:other/post/abc' })])), /source/);
  assert.throws(() => validateGarden(snapshot([link(), link()])), /duplicate Bluesky/);
  assert.equal(validateGarden(snapshot([link()]), '@example.bsky.social').entries.length, 1);
});
test('unknown content fields and unsafe links, images, dates, and media fail validation', () => {
  assert.throws(() => validateEntry(link({ thumnail: 'x' })), /unknown/);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//example.com']) assert.throws(() => validateEntry(link({ url })), /url/);
  for (const thumbnail of ['javascript:alert(1)', 'images/../../secret', '//tracking.example/pixel']) assert.throws(() => validateEntry(link({ thumbnail })), /thumbnail/);
  for (const added of ['2026-02-30', 'yesterday', '2026-9-2']) assert.throws(() => validateEntry(link({ added })), /added/);
});
test('canonical links remove tracking but preserve content identity', () => {
  assert.equal(canonicalUrl('https://example.com/a/?utm_source=b&a=1&fbclid=x#section'), 'https://example.com/a/?a=1#section');
  assert.notEqual(canonicalUrl('https://example.com/?id=1'), canonicalUrl('https://example.com/?id=2'));
  assert.notEqual(canonicalUrl('https://example.com/#one'), canonicalUrl('https://example.com/#two'));
});
test('HTML escapes profile and post content and keeps GitHub Pages asset paths', () => {
  const garden = validateGarden({ ...snapshot([link({ title: '<script>alert(1)</script>', note: '"quoted" & <text>', tags: ['</button>'] })]), profile: { ...profile, displayName: '<script>name</script>', description: '<bio> https://example.com/?a=1&b=2' } });
  const html = renderGarden(garden);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<script>name</script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="\.\/styles.css"/);
  assert.match(html, /src="\.\/garden.js"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /https:\/\/example.com\/\?a=1&amp;b=2/);
});
test('empty gardens show a useful prompt without samples or empty format options', () => {
  const html = renderGarden(snapshot());
  assert.match(html, /Posts tagged #garden on Bluesky will appear here/);
  assert.ok(!html.includes('Starter collection'));
  assert.ok(!html.includes('<option value="Books"'));
});
test('published pages request a matching asset version under a GitHub Pages subpath', () => {
  const html = renderGarden(snapshot(), { assetVersion: 'abc123' });
  for (const asset of ['styles.css', 'garden.js', 'media.js']) assert.ok(html.includes(`./${asset}?v=abc123`));
});
test('imports retain title, category, all other tags, media, date, and source', () => {
  const [entry] = entriesFromFeed([feedItem()], did);
  assert.equal(entry.title, 'A useful idea');
  assert.equal(entry.category, 'Papers');
  assert.deepEqual(entry.tags, ['paper', 'distributed-data']);
  assert.equal(entry.links[0].title, 'A good paper');
  assert.equal(entry.thumbnail, 'https://example.com/cover.png');
  assert.equal(entry.createdAt, '2026-09-25T12:00:00.000Z');
  assert.equal(entry.source, source);
});
test('engagement imports preserve zero and positive counts without inventing missing counts', () => {
  const [entry] = entriesFromFeed([feedItem({ replyCount: 0, likeCount: 1234 })], did);
  assert.equal(entry.replyCount, 0);
  assert.equal(entry.likeCount, 1234);
  for (const value of [undefined, null, -1, 1.5, '2', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const [unavailable] = entriesFromFeed([feedItem({ replyCount: value, likeCount: value })], did);
    assert.ok(!Object.hasOwn(unavailable, 'replyCount'));
    assert.ok(!Object.hasOwn(unavailable, 'likeCount'));
    if (value !== undefined) {
      assert.throws(() => validateEntry(link({ replyCount: value })), /replyCount/);
      assert.throws(() => validateEntry(link({ likeCount: value })), /likeCount/);
    }
  }
});
test('engagement links open the original post with exact accessible counts and compact visible numbers', () => {
  const html = renderGarden(validateGarden(snapshot([link({ replyCount: 1, likeCount: 1234 })])));
  const counts = [...html.matchAll(/<a class="engagement-count"[^>]*>.*?<\/a>/g)].map(([markup]) => markup);
  assert.equal(counts.length, 2);
  for (const markup of counts) {
    assert.ok(markup.includes(`href="${source}"`));
    assert.match(markup, /target="_blank" rel="noopener noreferrer"/);
  }
  assert.match(counts[0], /aria-label="1 reply on Bluesky \(opens in a new tab\)"/);
  assert.match(counts[1], /aria-label="1,234 likes on Bluesky \(opens in a new tab\)"/);
  assert.match(counts[1], /<span>1\.2K<\/span>/);
  assert.ok(!html.includes('class="source-link"'));
  assert.equal((html.match(/Engage on Bluesky/g) ?? []).length, 1); // The profile link remains.
  const zero = renderGarden(validateGarden(snapshot([link({ replyCount: 0, likeCount: 0 })])));
  assert.match(zero, /aria-label="0 replies on Bluesky/);
  assert.match(zero, /aria-label="0 likes on Bluesky/);
  assert.ok(!renderGarden(validateGarden(snapshot([link()]))).includes('class="engagement-count"'));
  const partial = renderGarden(validateGarden(snapshot([link({ likeCount: 1 })])));
  assert.match(partial, /aria-label="1 like on Bluesky/);
  assert.ok(!partial.includes('replies on Bluesky'));
});
test('only the owner’s marked posts are included, including explicitly marked replies', () => {
  const original = feedItem();
  const items = [
    { ...original, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } },
    feedItem({ author: { did: 'did:plc:someone-else' } }),
    feedItem({ record: { ...original.post.record, text: 'An unmarked link https://example.com' } }),
    feedItem({ record: { ...original.post.record, text: 'An unmarked reply', reply: {} } }),
    feedItem({ record: { ...original.post.record, text: '#gardening is different' } }),
  ];
  assert.deepEqual(entriesFromFeed(items, did), []);
  assert.equal(entriesFromFeed([feedItem({ record: { ...original.post.record, reply: {} } })], did).length, 1);
});
test('UTF-8 facets preserve multiple links and non-ASCII copy', () => {
  const text = '🌱 café https://a.test/one and https://b.test/two #garden';
  const facet = url => ({ index: { byteStart: Buffer.byteLength(text.slice(0, text.indexOf(url))), byteEnd: Buffer.byteLength(text.slice(0, text.indexOf(url) + url.length)) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }] });
  const [entry] = entriesFromFeed([feedItem({ embed: undefined, record: { text, createdAt: '2026-09-25T00:00:00Z', facets: [facet('https://a.test/one'), facet('https://b.test/two')] } })], did);
  assert.equal(entry.links.length, 2);
  assert.equal(entry.title, '🌱 café and');
});
test('record-with-media embeds and case-insensitive tags work', () => {
  const original = feedItem();
  const item = feedItem({ record: { ...original.post.record, text: 'Something #Garden #Paper' }, embed: { media: original.post.embed } });
  assert.equal(entriesFromFeed([item], did)[0].category, 'Papers');
});
test('a full feed snapshot deduplicates repeated posts and sorts by timestamp within a day', () => {
  const older = feedItem();
  const newer = feedItem({ uri: `at://${did}/app.bsky.feed.post/newer`, record: { text: 'A newer note #garden', createdAt: '2026-09-25T23:00:00Z' } });
  const garden = gardenFromFeed({ profile, feed: [older, newer, older] });
  assert.deepEqual(garden.entries.map(entry => entry.title), ['A newer note', 'A useful idea']);
  assert.equal(gardenFromFeed({ profile, feed: [] }).entries.length, 0);
});
test('pagination follows every page using the resolved DID and preserves profile identity', async () => {
  const calls = [];
  const result = await collectFeed(profile.handle, async (method, params) => {
    calls.push({ method, params });
    if (method.endsWith('getProfile')) return profile;
    return params.cursor ? { feed: [feedItem()] } : { feed: [feedItem()], cursor: 'page2' };
  });
  assert.equal(result.feed.length, 2);
  assert.deepEqual(result.profile, profile);
  assert.equal(calls[1].params.actor, did);
  assert.equal(calls[2].params.cursor, 'page2');
});
test('invalid feed responses and repeated cursors fail instead of truncating the garden', async () => {
  await assert.rejects(collectFeed(profile.handle, async method => method.endsWith('getProfile') ? profile : { feed: [], cursor: 'repeated' }), /repeated/);
  await assert.rejects(collectFeed(profile.handle, async method => method.endsWith('getProfile') ? profile : { error: 'unavailable' }), /invalid feed/);
});
