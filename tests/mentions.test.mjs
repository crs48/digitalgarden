import test from 'node:test';
import assert from 'node:assert/strict';
import { mentionsFromRecord, mentionSegments } from '../scripts/mentions.mjs';
import { entriesFromFeed } from '../scripts/bluesky.mjs';
import { validateEntry } from '../scripts/data.mjs';
import { renderGarden } from '../scripts/render.mjs';

const did = 'did:plc:friend';
const profile = { did: 'did:plc:owner', handle: 'owner.test', displayName: 'Owner', description: 'With @friend.test' };
const source = `https://bsky.app/profile/${profile.did}/post/abc`;
const entry = { title: 'Thanks @friend.test!', note: '🌱 More from @friend.test. <script>bad()</script>', url: 'https://example.com/', source, category: 'Notes', tags: [], mentions: [{ handle: 'friend.test', did }] };
const facet = (text, label, target = did) => ({ index: { byteStart: Buffer.byteLength(text.slice(0, text.indexOf(label))), byteEnd: Buffer.byteLength(text.slice(0, text.indexOf(label))) + Buffer.byteLength(label) }, features: [{ $type: 'app.bsky.richtext.facet#mention', did: target }] });

test('mentions retain account IDs using UTF-8 facets before links and hashtags are removed', () => {
  const text = '🌱 café #garden https://example.com/ Thanks @friend.test!';
  const record = { text, facets: [facet(text, '@friend.test')], createdAt: '2026-09-26T01:00:00Z' };
  const [imported] = entriesFromFeed([{ post: { uri: `at://${profile.did}/app.bsky.feed.post/abc`, author: profile, record } }], profile.did);
  assert.deepEqual(imported.mentions, entry.mentions);
  assert.ok(imported.title.includes('@friend.test'));
  assert.deepEqual(mentionsFromRecord({ ...record, facets: [...record.facets, ...record.facets] }), entry.mentions);
  for (const index of [{ byteStart: -1, byteEnd: 4 }, { byteStart: 1, byteEnd: 4 }, { byteStart: 0, byteEnd: 1000 }]) {
    assert.deepEqual(mentionsFromRecord({ ...record, facets: [{ ...record.facets[0], index }] }), []);
  }
});

test('handles link with punctuation and case preserved, while emails, URLs, and invalid handles stay intact', () => {
  const text = '(@FRIEND.test), @other.bsky.social. email@friend.test https://example.com/@friend.test @bad_handle.test @localhost';
  const parts = mentionSegments(text, entry.mentions);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.deepEqual(parts.filter(part => part.href), [
    { text: '@FRIEND.test', href: `https://bsky.app/profile/${did}` },
    { text: '@other.bsky.social', href: 'https://bsky.app/profile/other.bsky.social' },
  ]);
});

test('mention links render in titles, notes, and bios without nested anchors or unescaped HTML', () => {
  const html = renderGarden({ profile, entries: [entry] });
  assert.match(html, /class="mention" href="https:\/\/bsky.app\/profile\/did:plc:friend"/);
  assert.match(html, /class="mention" href="https:\/\/bsky.app\/profile\/friend.test"/);
  assert.match(html, /<h3>[\s\S]*class="mention"[\s\S]*<\/h3>/);
  assert.match(html, /<p class="entry-note">[\s\S]*class="mention"/);
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.doesNotMatch(html, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/);
  assert.doesNotThrow(() => validateEntry(entry));
  assert.throws(() => validateEntry({ ...entry, mentions: [{ handle: 'friend.test', did: 'javascript:alert(1)' }] }), /did/);
  assert.throws(() => validateEntry({ ...entry, mentions: [{ handle: 'bad_handle.test', did }] }), /handle/);
});
