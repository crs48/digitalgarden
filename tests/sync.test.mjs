import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncGarden } from '../scripts/sync-bluesky.mjs';
import { readGarden } from '../scripts/data.mjs';

const profile = { did: 'did:plc:owner', handle: 'owner.bsky.social', displayName: 'Owner', description: 'A garden.' };
const post = (id, text = 'Something to keep #garden') => ({ post: { uri: `at://${profile.did}/app.bsky.feed.post/${id}`, author: { did: profile.did }, record: { text, createdAt: '2026-09-26T12:00:00Z' } } });
const api = (feed, owner = profile) => async method => method.endsWith('getProfile') ? owner : { feed };
const workspace = async t => {
  const dir = await mkdtemp(join(tmpdir(), 'garden-sync-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return join(dir, 'content', 'garden.json');
};
test('a successful sync removes deleted and no-longer-marked posts and retains distinct posts about a URL', async t => {
  const filename = await workspace(t);
  await syncGarden({ handle: profile.handle, filename, fetchJson: api([post('one'), post('two')]) });
  const garden = await syncGarden({ handle: profile.handle, filename, fetchJson: api([post('one', 'No marker now'), post('three', '#garden https://example.com'), post('four', '#garden https://example.com')]) });
  assert.equal(garden.entries.length, 2);
  assert.ok(garden.entries.every(entry => /three|four/.test(entry.source)));
  assert.deepEqual((await readGarden(filename, profile.handle)).entries, garden.entries);
  await syncGarden({ handle: profile.handle, filename, fetchJson: api([]) });
  assert.equal((await readGarden(filename, profile.handle)).entries.length, 0);
});
test('a later-page outage keeps the entire previous snapshot byte-for-byte', async t => {
  const filename = await workspace(t);
  await syncGarden({ handle: profile.handle, filename, fetchJson: api([post('saved')]) });
  const previous = await readFile(filename, 'utf8');
  await assert.rejects(syncGarden({ handle: profile.handle, filename, fetchJson: async (method, params) => {
    if (method.endsWith('getProfile')) return profile;
    if (params.cursor) throw new Error('offline');
    return { feed: [post('new')], cursor: 'second-page' };
  } }), /offline/);
  assert.equal(await readFile(filename, 'utf8'), previous);
});
test('changing the configured account cannot expose the previous owner’s cache on an outage', async t => {
  const filename = await workspace(t);
  await syncGarden({ handle: profile.handle, filename, fetchJson: api([post('saved')]) });
  await assert.rejects(syncGarden({ handle: 'new.bsky.social', filename, fetchJson: async () => { throw new Error('offline'); } }), /offline/);
  await assert.rejects(readGarden(filename, 'new.bsky.social'), /does not match/);
  const next = { did: 'did:plc:new', handle: 'new.bsky.social' };
  await syncGarden({ handle: next.handle, filename, fetchJson: api([], next) });
  assert.equal((await readGarden(filename, next.handle)).profile.displayName, next.handle);
});
test('repeated imports are stable and do not add volatile profile counters to the snapshot', async t => {
  const filename = await workspace(t);
  await syncGarden({ handle: profile.handle, filename, fetchJson: api([post('saved')], { ...profile, followersCount: 1 }) });
  const first = await readFile(filename, 'utf8');
  await syncGarden({ handle: profile.handle, filename, fetchJson: api([post('saved')], { ...profile, followersCount: 999 }) });
  assert.equal(await readFile(filename, 'utf8'), first);
});
test('a mismatched profile response cannot replace the saved garden', async t => {
  const filename = await workspace(t);
  await syncGarden({ handle: profile.handle, filename, fetchJson: api([post('saved')]) });
  const previous = await readFile(filename, 'utf8');
  await assert.rejects(syncGarden({ handle: profile.handle, filename, fetchJson: api([], { did: 'did:plc:wrong', handle: 'wrong.bsky.social' }) }), /does not match/);
  assert.equal(await readFile(filename, 'utf8'), previous);
});
