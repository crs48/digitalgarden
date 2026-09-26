// Only known providers and direct files; never render HTML from posts or oEmbed.
const webUrl = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null; }
  catch { return null; }
};
const seconds = value => {
  if (/^\d+$/.test(value ?? '')) return Number(value);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value ?? '');
  return match ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : 0;
};
export const providerEmbed = value => {
  const url = webUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? parts[0] : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : url.pathname === '/watch' ? url.searchParams.get('v') : null;
    if (!/^[\w-]{11}$/.test(id ?? '')) return null;
    const start = seconds(url.searchParams.get('t') ?? url.searchParams.get('start') ?? url.hash.match(/t=(.+)/)?.[1]);
    return { type: 'youtube', label: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0${start > 0 ? `&start=${start}` : ''}` };
  }
  if (['vimeo.com', 'player.vimeo.com'].includes(host)) {
    const id = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
    if (!/^\d+$/.test(id ?? '')) return null;
    const hash = url.searchParams.get('h') ?? (host === 'vimeo.com' ? parts[1] : null);
    return { type: 'vimeo', label: 'Vimeo', src: `https://player.vimeo.com/video/${id}?dnt=1${/^[a-f\d]+$/i.test(hash ?? '') ? `&h=${hash}` : ''}` };
  }
  if (host === 'open.spotify.com') {
    const path = parts.filter(part => !/^intl-[a-z-]+$/.test(part) && part !== 'embed');
    if (!['track', 'album', 'playlist', 'episode', 'show'].includes(path[0]) || !/^[a-z\d]{22}$/i.test(path[1] ?? '')) return null;
    return { type: 'spotify', label: 'Spotify', src: `https://open.spotify.com/embed/${path[0]}/${path[1]}` };
  }
  if (['soundcloud.com', 'm.soundcloud.com'].includes(host) && parts.length >= 2) {
    return { type: 'soundcloud', label: 'SoundCloud', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com/${parts.slice(0, 2).join('/')}`)}&auto_play=false&visual=false` };
  }
  return null;
};
export const inferMedia = value => {
  const url = webUrl(value);
  if (!url) return null;
  const provider = providerEmbed(value);
  if (provider) return { type: provider.type, url: value };
  const path = url.pathname.toLowerCase();
  const type = /\.(?:avif|webp|png|jpe?g|gif)$/.test(path) ? 'image'
    : /\.(?:mp3|m4a|aac|ogg|oga|opus|wav|flac)$/.test(path) ? 'audio'
      : /\.(?:mp4|webm|mov|m4v|m3u8)$/.test(path) ? 'video' : null;
  return type ? { type, url: value } : null;
};
export const entryMedia = entry => entry.media ?? [inferMedia(entry.url)].filter(Boolean);
export const isHls = url => /\.m3u8$/i.test(new URL(url).pathname);
