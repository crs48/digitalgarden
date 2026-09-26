# Digital garden ✳

A quiet index of things worth returning to. Keep talks, papers, essays, books, films, and anything else in one YAML file. Publish on GitHub Pages. Optionally collect links by posting to Bluesky.

**[Visit the garden](https://crs48.github.io/digitalgarden/) · [Edit the collection](./garden.yaml)**

## Make it yours

1. Click **Use this template → Create a new repository**. Choose a public repository.
2. Edit [`garden.yaml`](./garden.yaml): change your name, introduction, personal links, and Bluesky handle. Replace the example entries. Remove `example: true` from any example you decide to keep; the starter notice disappears when none remain.
3. For a fresh collection, set `entries: []` and reset [`content/bluesky.json`](./content/bluesky.json) to `[]`. Set `bluesky.enabled: false` if you don't want imports.
4. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
5. Push to `main`, or run **Actions → Publish garden → Run workflow**. The workflow's deployment link is your site.

Works at `username.github.io/repository/`, at the root of a `username.github.io` repository, or on a custom domain. Assets use relative paths, so there is no base-path setting to get wrong. For a custom domain, configure it in GitHub Pages settings and follow [GitHub's domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).

## Add a link

Append to `entries` in `garden.yaml`, either locally or with GitHub's file editor:

```yaml
- title: A talk I keep coming back to
  url: https://example.com/talk
  creator: Someone thoughtful
  category: Talks
  year: 2024
  note: A few words about what stayed with me.
  tags: [body, movement, attention]
  added: 2026-09-25
  thumbnail: images/talk.jpg
```

Only `title` and `url` are required. A missing category becomes **Links**. A missing date sorts after dated entries in **Newest additions**. YAML order is the default collection order.

| Field | What it does |
| --- | --- |
| `creator` | Author, speaker, director, or source |
| `category` | Any format you like; new categories appear automatically |
| `note` | Your reason for keeping the link; plain text, including multiline YAML |
| `tags` | Any number of topics; multiple selected topics use **AND** |
| `thumbnail` | A remote image URL, or a file placed under `public/images/` |
| `year` | When the work was published |
| `added` | When you added it, using `YYYY-MM-DD` |
| `source` | Optional original Bluesky post or other provenance link |

The `categories` list sets the sidebar order and can include formats with no entries yet. Tag names are freeform; hyphens display as spaces. Search checks titles, authors, notes, categories, URLs, and tags. Filters are reflected in the URL, so a filtered collection can be bookmarked or shared. Press `/` to focus search and Escape to clear it.

The YAML schema offers autocomplete in compatible editors. The build rejects misspelled keys, invalid dates, duplicate links, missing local images, and unsafe URLs with a readable error.

## Collect from Bluesky

The default setting imports **your own original posts marked `#garden`**. For example, publish a post like:

```text
A lovely way to think about collaborative software.
https://www.inkandswitch.com/essay/local-first/
#garden #paper #programming #distributed-data
```

Every marked post becomes **one entry**, whether it contains a thought, a link, an image, a video, or several attachments. Every hashtag except `#garden` becomes a topic filter, including format hashtags like `#paper`. A known format hashtag also sets the format; otherwise media determines it automatically (Images, Videos, Audio, Notes, or Links). Marked replies are included; reposts are skipped.

Titles come from a short opening line or first sentence. The remaining copy becomes the note, with paragraph breaks preserved. Long titles are shortened at a word boundary while the full copy remains in the note. With no copy, the importer falls back to the link-preview title or a media description. This is deterministic text extraction, not an AI service: no extra account or API key is needed. To choose an exact title, write it on its own first line:

```text
Attention is a practice

A small reminder to notice what is already here.
#garden #attention #body
```

| Post content | Garden presentation |
| --- | --- |
| Text, with or without a URL | A readable note with a title drawn from your words |
| YouTube (watch, short, live, or share link) | Responsive YouTube player; timestamps are preserved |
| Vimeo | Responsive video player |
| Uploaded Bluesky image(s) | Full-width image or gallery with original alt text and full-size links |
| Uploaded Bluesky video or GIF | Inline video player; GIFs loop silently after you press play |
| Direct image URL (PNG, JPEG, WebP, GIF, AVIF) | Full-size image |
| Direct audio URL (MP3, M4A, AAC, OGG, Opus, WAV, FLAC) | Native audio player |
| Spotify or SoundCloud link | Embedded audio player |
| Direct video URL (MP4, WebM, MOV, M4V, HLS) | Native video player, with HLS support where needed |
| Other link | A source card using Bluesky's link-preview title and thumbnail |

Nothing starts playing automatically. Filtering an entry out pauses its native media and unloads its embedded player. Each player keeps an original-source link available if a host disables embedding or a file becomes unavailable. Audio and video codecs still depend on the browser; page links to unsupported services stay usable as links. Remote media is referenced, not downloaded into your repository.

```yaml
bluesky:
  enabled: true
  handle: your-name.bsky.social
  mode: hashtag       # hashtag | all-links | manual
  hashtag: garden     # without the #
  defaultCategory: Links
  categoryTags:
    paper: Papers
    video: Videos
    book: Books
    movie: Movies
    tv: TV shows
  excludeUrls: []
```

- **`hashtag`** imports every marked post, including text-only posts; **`all-links`** additionally imports unmarked original posts containing a link. Replies still require the marker.
- **`manual`** disables automatic importing. Run `npm run sync -- --force` to import marked posts locally, then commit the archive.
- **`enabled: false`** disables both importing and the display of saved imports.
- The GitHub workflow checks every six hours, on each push to `main`, and on manual runs. Scheduled runs can be delayed by GitHub, and [GitHub disables schedules after 60 days of repository inactivity](https://docs.github.com/en/actions/using-workflows/disabling-and-enabling-a-workflow). Re-enable the workflow if needed.
- The importer uses the public Bluesky API. No app password, token, or browser login is needed. It never posts to your account.
- Imports are saved in `content/bluesky.json` and committed by the workflow. They remain available if Bluesky is offline or a post disappears. **Deleting a Bluesky post does not remove an archived garden entry.** Put the saved entry’s URL or its `source` post URL in `excludeUrls` to remove it and prevent reimporting.
- Each imported post has a stable identity, so different posts about the same link are preserved and repeat imports update rather than duplicate them. A YAML entry without `source` and with the same URL takes precedence over matching imports. Tracking parameters are ignored; meaningful query parameters and URL fragments are preserved.
- A failed import preserves the saved collection; publishing continues with that collection and an Actions warning. The importer paginates through up to 5,000 posts, then fails visibly rather than silently truncating a larger history.
- Saving imports requires the workflow's `contents: write` permission. If branch protection blocks the bot's direct commits, run imports locally or adapt the workflow to your repository's review policy.

```mermaid
flowchart LR
  YAML["garden.yaml · your collection"] --> Build[Static build]
  Posts["Your Bluesky posts · #garden"] --> Sync[Public API import]
  Sync --> Extract["Title · all hashtags · links · attachments"]
  Extract --> Archive["content/bluesky.json · saved posts"]
  Archive --> Build
  Build --> Pages[GitHub Pages]
  Pages --> Reader[Browse · search · follow a topic]
```

## Media in YAML

Known media URLs are recognized automatically. For multiple attachments or a media URL without a recognizable extension, use `media` explicitly:

```yaml
- title: A field recording
  url: https://example.com/recording
  category: Audio
  tags: [attention, nature]
  media:
    - type: audio
      url: https://example.com/recording.mp3

- title: A pair of sketches
  url: https://example.com/sketches
  category: Images
  media:
    - type: image
      url: https://example.com/sketch-one.jpg
      alt: A sketch of a branching tree
    - type: image
      url: https://example.com/sketch-two.jpg
      alt: An overhead view of the same tree
```

Supported `type` values are `image`, `video`, `audio`, `youtube`, `vimeo`, `spotify`, and `soundcloud`. Images and videos may include `width` and `height`; videos may include `poster` and `loop`. Set `media: []` to show an ordinary link instead of an inferred embed. Raw embed HTML and arbitrary iframes are not accepted. Imported entries also retain a `links` list so multiple links stay together under one post.

## Develop

Use Node.js 22 or newer (the workflow uses Node.js 24).

```sh
npm ci
npm run dev       # http://localhost:4321; rebuilds when files change, refresh to see edits
npm run sync      # collect eligible public Bluesky posts and media
npm run check     # run tests and build
npm run build     # output in dist/
```

If the default port is busy, use `PORT=4318 npm run dev`. The preview also serves `/digitalgarden/` to check project-site paths.

The build uses the YAML parser. A self-hosted HLS.js player loads on demand only when a visitor plays a streaming video; native HLS is the fallback when Media Source Extensions are unavailable. The output is static HTML, CSS, and a small script for filtering. Links and notes work without JavaScript. No accounts, database, analytics, or client-side Bluesky requests. Google Fonts provides Inter, with system-font fallbacks; remote images and embedded players are loaded from their source hosts. YouTube uses its privacy-enhanced domain. Self-host these assets if you prefer no third-party requests.

| File | Purpose |
| --- | --- |
| `garden.yaml` | Content, site identity, and import settings |
| `garden.schema.json` | Editor hints and schema |
| `content/bluesky.json` | Durable imported collection |
| `src/styles.css` | Typography, colors, and responsive layout |
| `src/garden.js` | Search, filter, and sort behavior |
| `scripts/` | Validation, rendering, development, and import code |
| `.github/workflows/pages.yml` | Import, build, and publish |

Implementation references: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Bluesky API](https://docs.bsky.app/), and [rich-text facets](https://docs.bsky.app/docs/advanced-guides/post-richtext), [YouTube players](https://developers.google.com/youtube/player_parameters), [Spotify embeds](https://developer.spotify.com/documentation/embeds), and [HLS.js](https://github.com/video-dev/hls.js).

## License

MIT. Linked works, third-party thumbnails, and their copyrights belong to their respective creators.
