import { isDid, normalizeHandle } from './data.mjs';

const handleOrNull = value => {
  try { return normalizeHandle(value); } catch { return null; }
};

export const mentionsFromRecord = record => {
  const bytes = new TextEncoder().encode(record.text);
  const mentions = (record.facets ?? []).flatMap(facet => {
    const did = facet.features?.find(feature => feature.$type === 'app.bsky.richtext.facet#mention')?.did;
    const { byteStart, byteEnd } = facet.index ?? {};
    if (!isDid(did) || !Number.isInteger(byteStart) || !Number.isInteger(byteEnd) || byteStart < 0 || byteEnd <= byteStart || byteEnd > bytes.length) return [];
    // Decode the original UTF-8 range before copy cleanup changes its offsets.
    try {
      const label = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(byteStart, byteEnd));
      const handle = label.startsWith('@') ? handleOrNull(label) : null;
      return handle ? [{ handle, did }] : [];
    } catch { return []; }
  });
  return [...new Map(mentions.map(mention => [mention.handle, mention])).values()];
};

export const mentionSegments = (text, mentions = []) => {
  const accounts = new Map(mentions.map(({ handle, did }) => [handle, did]));
  // Consume URLs whole and require a boundary before @ so emails stay plain text.
  return text.split(/(https?:\/\/[^\s<>]+|(?<![\p{L}\p{N}_@./:+-])@[a-z0-9._-]+)/giu).filter(Boolean).flatMap(part => {
    if (!/^@[a-z0-9._-]+$/i.test(part)) return [{ text: part }];
    const label = part.replace(/\.+$/, '');
    const handle = handleOrNull(label);
    if (!handle) return [{ text: part }];
    return [
      { text: label, href: `https://bsky.app/profile/${accounts.get(handle) ?? handle}` },
      ...(part.length > label.length ? [{ text: part.slice(label.length) }] : []),
    ];
  });
};
