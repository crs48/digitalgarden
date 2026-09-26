const fail = media => {
  const panel = media.closest('.media-panel');
  const message = panel?.querySelector('.media-error');
  if (message) message.hidden = false;
};
let hlsModule;
document.querySelectorAll('video[data-hls]').forEach(video => {
  const button = video.parentElement.querySelector('[data-video-load]');
  const nativeHls = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));
  let player;
  if (!nativeHls) video.querySelector('source')?.remove();
  button.hidden = false;
  video.controls = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.querySelector('span:last-child').textContent = 'Loading…';
    try {
      hlsModule ??= import('./vendor/hls.light.mjs').catch(error => { hlsModule = undefined; throw error; });
      const { default: Hls } = await hlsModule;
      // Some browsers report native HLS support but stall on these streams.
      // Prefer MSE when available, retaining native playback as the fallback.
      if (Hls.isSupported()) {
        video.querySelector('source')?.remove();
        video.load();
        player = new Hls({ maxBufferLength: 20 });
        player.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { fail(video); player.destroy(); } });
        player.loadSource(video.dataset.hls);
        player.attachMedia(video);
      } else if (!nativeHls) throw new Error('Streaming playback is not supported');
      button.hidden = true;
      video.controls = true;
      await video.play();
    } catch {
      video.controls = true;
      button.hidden = true;
      fail(video);
    }
  });
});
document.querySelectorAll('video, audio').forEach(media => media.addEventListener('error', () => fail(media)));
document.querySelectorAll('.full-image img').forEach(img => {
  const fallback = () => {
    const link = img.closest('a');
    img.hidden = true;
    link.classList.add('image-unavailable');
    link.textContent = 'Image unavailable — open the original';
  };
  img.addEventListener('error', fallback);
  if (img.complete && !img.naturalWidth) fallback();
});
document.querySelectorAll('.link-preview img').forEach(img => img.addEventListener('error', () => { img.hidden = true; }));
// A filtered-out player should not keep playing out of sight.
document.addEventListener('garden:filter', () => {
  document.querySelectorAll('.entry').forEach(entry => {
    if (entry.hidden) entry.querySelectorAll('video, audio').forEach(media => media.pause());
    entry.querySelectorAll('iframe').forEach(frame => {
      if (entry.hidden && frame.hasAttribute('src')) { frame.dataset.resumeSrc = frame.getAttribute('src'); frame.removeAttribute('src'); }
      else if (!entry.hidden && frame.dataset.resumeSrc) { frame.src = frame.dataset.resumeSrc; delete frame.dataset.resumeSrc; }
    });
  });
});
document.dispatchEvent(new Event('garden:filter'));
