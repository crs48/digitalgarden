import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesFromFeed, titleFromCopy } from '../scripts/bluesky.mjs';
import { inferMedia, providerEmbed } from '../scripts/media.mjs';
import { validateConfig, validateEntry, mergeEntries } from '../scripts/data.mjs';
import { renderGarden } from '../scripts/render.mjs';

const site = { title: 'Garden', owner: 'Someone', heading: 'A collection', description: 'Things to keep' };
const settings = validateConfig({ site, entries: [], bluesky: { categoryTags: { paper: 'Papers' } } }).bluesky;
const did = 'did:plc:example';
const item = (text, embed, extra = {}) => ({ post: { uri: `at://${did}/app.bsky.feed.post/one`, author: { did }, record: { text, createdAt: '2026-09-25T12:00:00Z', ...extra }, embed } });
const importOne = (text, embed, extra) => entriesFromFeed([item(text, embed, extra)], settings, did)[0];

test('every marked text post becomes an entry with all other hashtags', () => {
  const entry = importOne('A thought about attention.\nRoom to slow down. #garden #body #spirituality #paper');
  assert.equal(entry.title, 'A thought about attention.');
  assert.equal(entry.note, 'Room to slow down.');
  assert.equal(entry.category, 'Papers');
  assert.deepEqual(entry.tags, ['body', 'spirituality', 'paper']);
  assert.equal(entry.url, entry.source);
  assert.equal(importOne('Only a thought #garden').category, 'Notes');
});
test('marked replies are collected but unmarked posts and reposts are not', () => {
  assert.equal(importOne('Worth saving #garden', undefined, { reply: {} }).category, 'Notes');
  assert.equal(importOne('Not marked #gardening'), undefined);
  assert.equal(entriesFromFeed([{ ...item('#garden'), reason: { $type: 'repost' } }], settings, did).length, 0);
});
test('titles use standalone headings, sentences, and preview fallbacks without losing copy', () => {
  assert.deepEqual(titleFromCopy('Small observations\n\nThe body learns slowly.', 'fallback'), { title: 'Small observations', note: 'The body learns slowly.' });
  assert.deepEqual(titleFromCopy('One idea. Another idea.', 'fallback'), { title: 'One idea.', note: 'Another idea.' });
  const long = 'a careful thought about attention and movement '.repeat(6);
  const entry = titleFromCopy(long, 'fallback');
  assert.ok(entry.title.length <= 88 && entry.title.endsWith('…'));
  assert.equal(entry.note, long);
  assert.equal(importOne('#garden', { external: { uri: 'https://example.com', title: 'The linked work' } }).title, 'The linked work');
});
test('native images keep full resolution, alt text, dimensions, and gallery order', () => {
  const entry = importOne('A diagram #garden #viz #code', { images: [
    { fullsize: 'https://images.test/one', alt: 'Programming paradigms', aspectRatio: { width: 2000, height: 1200 } },
    { fullsize: 'https://images.test/two', alt: 'A second diagram' },
  ] });
  assert.equal(entry.category, 'Images');
  assert.equal(entry.media.length, 2);
  assert.equal(entry.media[0].width, 2000);
  assert.equal(entry.media[0].alt, 'Programming paradigms');
  assert.deepEqual(entry.tags, ['viz', 'code']);
});
test('native Bluesky GIF videos preserve streaming URLs and silent looping', () => {
  const entry = importOne('A dancing panda #garden #gif', { playlist: 'https://video.bsky.app/example/playlist.m3u8', thumbnail: 'https://video.bsky.app/example/thumbnail.jpg', presentation: 'gif', aspectRatio: { width: 120, height: 120 } });
  assert.deepEqual(entry.media[0], { type: 'video', url: 'https://video.bsky.app/example/playlist.m3u8', poster: 'https://video.bsky.app/example/thumbnail.jpg', width: 120, height: 120, loop: true });
  assert.equal(entry.category, 'Videos');
});
test('quoted-post attachments are extracted without importing the quoted author', () => {
  const entry = importOne('My observation #garden', { media: { images: [{ fullsize: 'https://images.test/one', alt: 'Something' }] }, record: { text: 'Someone else' } });
  assert.equal(entry.media[0].type, 'image');
  assert.equal(entry.title, 'My observation');
});
test('YouTube watch, short, live, and timestamp links use the privacy-enhanced player', () => {
  for (const url of ['https://youtu.be/abcdefghijk?t=1m30s', 'https://www.youtube.com/watch?v=abcdefghijk&t=90', 'https://youtube.com/shorts/abcdefghijk?t=90', 'https://youtube.com/live/abcdefghijk?start=90']) {
    assert.equal(providerEmbed(url).src, 'https://www.youtube-nocookie.com/embed/abcdefghijk?playsinline=1&rel=0&start=90');
  }
  assert.equal(providerEmbed('https://youtube.com/watch?v=bad'), null);
  assert.equal(providerEmbed('https://youtube.com.evil.test/watch?v=abcdefghijk'), null);
  assert.equal(providerEmbed('javascript:alert(1)'), null);
});
test('audio services and direct media files are recognized with query strings', () => {
  assert.equal(inferMedia('https://media.test/audio.mp3?download=1').type, 'audio');
  assert.equal(inferMedia('https://media.test/PHOTO.JPG?key=abc').type, 'image');
  assert.equal(inferMedia('https://media.test/movie.webm').type, 'video');
  assert.equal(inferMedia('https://media.test/an-essay'), null);
  assert.equal(providerEmbed('https://open.spotify.com/intl-en/track/0123456789abcdefghijkl').src, 'https://open.spotify.com/embed/track/0123456789abcdefghijkl');
  assert.match(providerEmbed('https://soundcloud.com/artist/track').src, /^https:\/\/w.soundcloud.com\/player/);
  assert.match(providerEmbed('https://vimeo.com/123456/abcdef').src, /h=abcdef/);
});
test('multiple media links stay together in one post and infer their format', () => {
  const entry = importOne('A listening note #garden #attention\nhttps://media.test/one.mp3 https://media.test/two.mp3');
  assert.equal(entry.category, 'Audio');
  assert.equal(entry.links.length, 2);
  assert.equal(entry.media.length, 2);
});
test('post identity preserves distinct notes about the same link and refreshes existing posts', () => {
  const a = { title: 'One note', url: 'https://example.com', source: 'https://bsky.app/profile/a/post/one' };
  const b = { ...a, title: 'Another note', source: 'https://bsky.app/profile/a/post/two' };
  assert.equal(mergeEntries([a, b], []).length, 2);
  assert.deepEqual(mergeEntries([{ ...a, title: 'Updated' }], [a, b]).map(entry => entry.title), ['Updated', 'Another note']);
  assert.equal(mergeEntries([{ title: 'Curated', url: a.url }], [a, b]).length, 1);
  assert.equal(mergeEntries([], [a, b], [a.source]).length, 1);
});
test('media validation rejects arbitrary frames, script URLs, attributes, and invalid dimensions', () => {
  const base = { title: 'Test', url: 'https://example.com' };
  for (const media of [
    { type: 'iframe', url: 'https://evil.test' },
    { type: 'youtube', url: 'https://evil.test/watch?v=abcdefghijk' },
    { type: 'image', url: 'javascript:alert(1)' },
    { type: 'video', url: 'https://media.test/video.mp4', width: '1; color:red' },
    { type: 'audio', url: 'https://media.test/audio.mp3', onload: 'evil' },
  ]) assert.throws(() => validateEntry({ ...base, media: [media] }), /media/);
});
test('rendering includes native controls, readable captions, alt text, and fallback links', () => {
  const entries = [validateEntry({ title: 'Media <test>', url: 'https://example.com', tags: ['body'], media: [
    { type: 'image', url: 'https://media.test/image.png', alt: 'A <diagram>' },
    { type: 'audio', url: 'https://media.test/audio.mp3' },
    { type: 'video', url: 'https://media.test/playlist.m3u8', loop: true },
    { type: 'youtube', url: 'https://youtu.be/abcdefghijk' },
  ] })];
  const html = renderGarden(validateConfig({ site, entries: [] }), entries);
  assert.match(html, /alt="A &lt;diagram&gt;"/);
  assert.match(html, /<audio controls preload="none"/);
  assert.match(html, /loop muted/);
  assert.match(html, /data-hls=/);
  assert.match(html, /youtube-nocookie.com/);
  assert.match(html, /strict-origin-when-cross-origin/);
  assert.match(html, /Open original/);
  assert.ok(!html.includes('autoplay=1'));
});
