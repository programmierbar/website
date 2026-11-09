# heise.de integration

heise.de features some of our episodes. Their newsroom gets a page per episode with everything
they need: the cover, title, publishing date, Anriss, the people on the episode, full text, a
closing paragraph (Abspann), the episode link and the YouTube URL.

## The link

```
https://www.programmier.bar/integrations/heise/podcast/<slug>?token=<NUXT_HEISE_ACCESS_TOKEN>
```

The page answers 404 unless both of these hold:

- `token` matches `NUXT_HEISE_ACCESS_TOKEN`
- the podcast has `heise_enabled` set

A wrong token gets the same 404 as a podcast that does not exist. The page shows drafts too,
because heise reviews episodes before they are public.

There is one token for all episodes. Rotating it means changing the env var in Vercel and
redeploying. After that, every link sent so far stops working.

If `NUXT_HEISE_ACCESS_TOKEN` is not set, the page answers 500 instead of opening up.

## CMS fields

These fields are on `podcasts`, in the "Heise.de Integration" group:

| Field           | Shown as                                    |
| --------------- | ------------------------------------------- |
| `heise_enabled` | Gate: the page exists only when this is on  |
| `heise_titel`   | Heading                                     |
| `heise_cover`   | Cover, with a download of the original file |
| `heise_anriss`  | Anriss, with a copy button                  |
| `heise_text`    | Full text, with a copy button               |

Besides these, the page shows from the regular podcast fields:

- `published_on`, as date and time in Berlin time
- the people on the episode by name, in the order set in the CMS: `speakers` as "Gäste" and
  `members` as "Hosts"

The Abspann is the same for every episode, so it is fixed in
`pages/integrations/heise/podcast/[slug].vue`. Its links come from the constants in `config.ts`.

The copy buttons on Anriss, full text and Abspann put both HTML and plain text on the clipboard, so
a rich text editor keeps the formatting.

## Directus permissions

The page reads through the API token (`NUXT_DIRECTUS_API_TOKEN`), not the public role. That
token's role needs read access on:

- `podcasts`: `slug`, `published_on`, `youtube_url`, `speakers`, `members`, `heise_enabled`,
  `heise_titel`, `heise_anriss`, `heise_text`, `heise_cover`
- `directus_files`: for the cover's dimensions and type
- `podcast_speakers`: `sort`, `speaker`
- `speakers`: `academic_title`, `first_name`, `last_name`
- `podcast_members`: `sort`, `member`
- `members`: `first_name`, `last_name`

## Caching

`/integrations/**` is neither cached (ISR) nor prerendered, so the page always shows the CMS as
it is right now.
