# SimDesk

A web app for running a Sims 4 forever save: every Sim, household, world, lot, club and custom holiday in one organized place. Version 1 as described in the SimDesk Build Brief (Nov 2, 2026).

## What's in version 1

- **Save setup**: the full animated flow (welcome burst, name/cover/color, packs, time and lifespans, flip-card modules, confetti finale, shuffle-and-fan category deck).
- **Sims**: list with search and life stage filter, profiles with a big portrait, "through the years" stage photos, traits (game + custom), aspiration, occults (more than one for hybrids), career, pronouns, orientation, notes, relationships (with **secret** flag, e.g. a public dad and a secret biological dad), mark as deceased.
- **Households**: table with world, home lot, member avatars and rotation status (when the Rotation module is on).
- **Calendar**: the season as a grid sized to the season length, with holidays (up to 5 traditions), birthdays, age-ups and weekly club meetings. Jump ahead with a recap.
- **Worlds and lots**: rename worlds, "inspired by" and vibe notes, neighborhood chips, your own map image with numbered, color-coded pins (home, community, empty) and click-to-pin, lot list, lot pages with build photos, build credits (EA ID + Copy), lot traits, history timeline, connected clubs/households, notes.
- **Clubs**: custom purpose, roles, members with roles, activities, meeting lot and weekday, linked clubs.
- **Save settings**: Track today's date, set date, season length, lifespans (incl. custom), packs, module switches, delete save.
- **Accounts**: sign up, log in, password reset, sync across devices (Supabase). Also a guest mode that keeps saves in the browser only.
- Light and dark mode, desktop-first with a one-column phone layout, respects Reduce Motion.

## The ground rules, and where they live in the code

| Rule | Where |
| --- | --- |
| Game defaults, fully editable | `public/game-data/*.json` + per-save overrides (`WorldRecord`, `LotRecord`) |
| Blank by default | Setup creates no households or holidays |
| Forgetting to update never breaks anything | `src/lib/time.ts` stores only the save date; ages are calculated from birthdays |
| As detailed as you want | `src/lib/modules.ts`; off hides, never deletes |
| Secrets are in-story | Relationship `secret` flag, labeled "Secret" |
| Only the player's packs | `ownedFilter` in `src/data/gameData.ts` |
| Fast with 300 Sims | Whole save loads once into memory; lists filter in one pass; rows use `content-visibility`; photos are shrunk to WebP before upload |
| One name, one place | `src/config/app.ts` |

## Running it

```bash
npm install
cp .env.example .env     # already filled in with the simdesk Supabase project
npm run dev              # http://localhost:5173
npm test                 # time engine tests
npm run build            # production build in dist/
```

## Game data

The app loads reference data from `public/game-data/*.json`, imported from the `simdesk-game-data` workbook (117 packs, 256 traits, 95 aspirations, 10 occults, 47 traditions, 31 worlds, 93 neighborhoods, 403 lots (9 of them secret), 52 lot types). Lifespans come from its Life stages tab; half days on Short are rounded to whole days because the game counts whole days.

To update it after editing the workbook:

```bash
npm run import-workbook -- path/to/simdesk-game-data.xlsx
```

**World maps** live separately in `public/game-data/maps.json` (the import never touches them). Each world can have a built-in map image (in `public/game-data/maps/`), a list of plot spots (`plots`, as % of the image, numbered from 1) and `pins` linking lot ids to plot numbers. Players' own uploaded maps and pins always win over the built-in ones. Newcrest, Willow Creek and Oasis Springs maps are in; their pins are waiting on which lot goes on which plot.

It reads the tabs by name (Packs, Life stages, Traits, Aspirations, Occult types, Holiday traditions, Worlds, Neighborhoods, Secret areas, Lots, Lot types), is forgiving about column headers, and tells you about any pack names or tabs it couldn't match. Commit the updated JSON and redeploy. That's a data change, no code change.

**Adding a new pack:** fill in `docs/new-pack-template.xlsx` (its Start here tab walks through it; grey rows tagged "Example Pack" are ignored), then either paste the rows into the main workbook or import both files together:

```bash
npm run import-workbook -- simdesk-game-data.xlsx my-new-pack.xlsx
```

**Secret lots** (lot type Secret Lot, Secret Lab or The Magic Realm, Sixam, and one-offs tagged "Hidden lot" like the Hermit's House) are imported with `secret: true` and stay hidden until a player turns them on in Save settings. **Career buildings** (Hospital, Police Station, FutureSim Labs, Acting Studio) are grouped under a "Career buildings" neighborhood. When a player adds a pack in Save settings, a "New from (pack)" message shows what it added.

## Supabase

Project: **simdesk** (`pyszlcaaotkituvvpvvw`), SimDesk's own project. (The older app lives separately in **simbase**.) Schema: `supabase/migrations/`.

- `sd_saves`: one row per save
- `sd_records`: everything inside a save (`kind` = sim, household, relationship, world, lot, holiday, club)
- `sd_custom_traits`: custom traits and trait packs, shared across a player's saves
- `sd_profiles`: account settings and `plan` (for the paid tier later)
- Storage bucket `sd-media`: photos, each player writes only into their own folder

Row-level security means each player only ever sees their own rows.

**Before launch, in the simdesk project's Supabase dashboard:**
1. Authentication → URL Configuration: set Site URL to `https://simdesk.life` and add it (and any preview URLs) to Redirect URLs, so confirmation and reset emails link back correctly.
2. Authentication → Providers → Email: optionally turn on leaked password protection (the security advisor flags it).
3. Consider custom SMTP for auth emails; Supabase's built-in sender is rate limited.

## Deploying (GitHub Pages)

1. Push this repo to GitHub (branch `main`).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`: tests, build, publish. The site lands at `https://<you>.github.io/<repo>/`.
4. In the simdesk Supabase project: **Authentication → URL Configuration**, set Site URL to that address and add it (plus `http://localhost:5173`) to Redirect URLs.

Links use `#` (like `…/simdesk/#/s/…/sims`), so GitHub Pages only ever serves `index.html`. Refreshing or opening a shared link never hits a 404.

**When you buy simdesk.life:** add it under Settings → Pages → Custom domain, set the Actions variable `PAGES_BASE_PATH` to `/`, and change the Supabase Site URL to `https://simdesk.life`.

## Known gaps / next up

- The workbook's known gaps: Batuu and Jungle District lots, 5 lot sizes, 4 aspirations to confirm, Adventure Awaits / Royalty & Legacy traits, world map images and pin positions (the World page's "Use my map" + "Place pins" works as the click-to-pin tool).
- Storylines and the other modules are switches only; the Storylines page says it's coming.
- Guest saves don't move into an account yet.
- Icons use Phosphor Duotone as the stand-in for the final rounded set.
