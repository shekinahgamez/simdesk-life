# SimDesk handoff (for a fresh code chat)

Read `DESIGN-RULES.md` first, then this file. The owner (a friend, not a developer) follows everything on a phone.

## How to work with them (standing rules)
- **Mockups first, then approval, then code.** Anything visual: send screenshots (SendUserFile, not interactive artifacts), wait for "approved", then build. Don't code first.
- **Build exactly what was approved.** If the approved mockup and an existing app component differ, the mockup wins. If you want to deviate, say so and ask. Do not say "matches" unless you compared the real screenshot to the mockup side by side.
- One feature at a time: describe it, OK, build, test, show real-app screenshots as proof ("I can't just trust that you did it").
- "No assumptions pls." If something is ambiguous, ask, or state the reading you used.
- Talk like a friend. Lean wording in SimDesk's voice. Careful with credits.
- Don't refresh or publish the preview until told. Don't commit or push unless asked.
- Hard constraints: Supabase project **simdesk (pyszlcaaotkituvvpvvw)** only. Never touch simbase (pczvxbuipkeksnpeqehp). Never put the owner's personal views on the site. No new map creation. Don't host EA map art.

## Project
Vite 6 + React 18 + TypeScript at `/home/user/simdesk-life` (not a git repo). Pages: https://shekinahgamez.github.io/simdesk-life/. Local-first sync store (IndexedDB), hash routing `#/s/<saveId>/<section>`. Preview artifact (stale, v37): https://claude.ai/artifact/TtJeWSUUmJC7ZA3o4LUR2A. Zip `/home/user/simdesk-code.zip` is stale too (rebuild with `zip -rq ... -x '*.tsbuildinfo'` when asked).

## What is done and approved
Maps out and world scenes in, Plot Matcher notes removed, Sim tile soft melt, batch 2 and 3 worlds, no Black History Month banner, lot rename gap, world page redesign, Willow Creek pink trees, Photos area (event page, photo viewer, album with iPhone-style sections), `DESIGN-RULES.md`.

## Photos filter sheet: rebuilt to the approved mockups (awaiting the owner's review of real screenshots)
Built in `FilterSheet` (`src/pages/photos/PhotosPage.tsx`), styles at the end of `src/styles/photos.css`. Matches `_handoff/approved-mockups/` plus the later-approved screens in `_handoff/mockups-pending/` (Sims checklist, Occasion list, When calendar). Side-by-side proof images are in `_handoff/compare/`.
- Plain field rows (SIMS / WHEN / OCCASION), no chevrons (owner OK'd), "Change" on Sims only. White-pill Sort switch. "Show N photos" + "Clear all" (phone: stacked, desktop: Clear all left, Show right). No hint line.
- Tapping a row swaps the sheet to its list; the back arrow returns. Sims: search, checkboxes, avatar and photo count, chosen Sims under "Selected". Several Sims = photos with ALL of them (owner confirmed). Occasion: search, "Any" first, date under each name, tap picks and returns.
- **When is a date range** picked with the app's calendar picker (`RangePanel` in `SeasonPicker.tsx`, the same code `RangeField` uses). Filter is `from`/`to` game day numbers; whole season reads "Spring · Year 1", else "Spring 3 → Spring 12 · Year 1". Photos with no game date drop out while a range is on. When and Sort are hidden for saves that don't track the date.
- Photo viewer prev/next now follows the list it was opened from (grid filter and sort, a Sim's photos, an occasion's photos). Filters and sort now survive opening a photo and coming Back (`gridState`).
- Design rule added: every game-date picker uses the calendar picker (see `DESIGN-RULES.md`).
- Season name is "Fall" in the app; the old mockups said "Autumn". The app's name is used.

## Clubs (built; the owner has approved the mockups in `_handoff/clubs-mockups-v3/`, real screenshots are in `_handoff/compare-clubs/`)
Only for saves with the Get Together pack on (`needsPack` in `categories.tsx`: sidebar, deck, More page, setup deck; opening `/clubs` without it shows "Clubs need Get Together").
- `src/lib/clubs.ts` (+ `clubs.test.ts`): `ClubData`, `clubData` (cleans junk), `cleanClub`, `withMembers` (leader is always a member), `clubCountOf` (a Sim is in up to 3 clubs), `canJoinClub` (no newborn, infant or toddler), `activitySuggestions` (activities other clubs already use).
- `src/pages/clubs/`: `ClubsPage.tsx` (list + club page; an aimed-at club shows as a pill with the club icon), `ClubForm.tsx` (one window, many screens: form, Members, Leader, Meets at, Aimed at, Requirement category and value, Perk; bottom sheet on phones), `SimClubs.tsx` (card on the Sim profile), `shared.tsx` (`useClubs`). Styles in `src/styles/clubs.css` (reuses the `ph-*` classes from the Photos filter).
- Photos: `PhotoData.clubId`, the photo form has Sims and Club as plain rows with lists, a Club row in the Filter sheet (only shows when a club has photos), a Clubs group in search suggestions, "Club: Name" link on the photo page, a Photos card on the club page (`ClubPhotos`).
- Decisions the owner made: activities, requirements and perks are typed in (Age and Trait use the app's own lists); no member limit; no club logo; no premade clubs; no club points or gatherings.
- Left alone on purpose: deleting a club keeps rules that were aimed at it (the pill just disappears); Sims who have passed aren't offered as members; a removed Sim shows as "Removed Sim".
- Tests: `_handoff/test-scripts/testclubs.cjs` (132 checks, wide and phone). `shotsclubs.cjs` makes the real-app screenshots.

## Photos code map
- `src/lib/album.ts`: `groupOf`, `groupPhotos(rows, cal, mode)`, `filterPhotos`, `matchesText`, `suggest`, `itemKey`, `AlbumFilter`, `SortMode`. Several Sims selected means photos with ALL of them in (owner confirmed). `filterPhotos(rows, f, namer)`, `rangeText`, `hasRange`. Tests in `src/lib/album.test.ts` (24).
- `src/pages/photos/PhotosPage.tsx`: `useAlbum` (now also gives `occasionName` and `namer`), `PhotoGrid` (bar, summary, suggestions, `panel` = the filter sheet body to restyle, `filterUi` = Sheet on phone, Modal on desktop), `PhotoPage` (viewer), `PhotoForm`, `ItemPhotos`, `SimPhotos`.
- `src/styles/photos.css`: `.ph-sum`, `.ph-suggest`, `.ph-sg*`, `.ph-tiles.n1/.n2`.
- Bug already fixed: focus tracking must be on the search box only, not the whole bar (otherwise tapping Filter on phone turned the button into Cancel).

## Tests
Scripts are in `_handoff/test-scripts/` (originals in the scratchpad). `withserver.sh` has hard-coded scratchpad paths; adjust if the scratchpad changed. Run `npm run build` first (it serves `dist` with `vite preview` on 4173). Last results: vitest 111, testphotos 135, testclubs 132, testsims 65, testdeck 23, testworlds 67, all passing. Scripts are in `_handoff/test-scripts/` (testphotos updated; its fixture `portrait.png` is any small PNG). `testphotos.cjs` queries the filter fields by label (`getByLabel('Occasion')`, `getByRole('button', { name: 'Date added' })`), so update it when the sheet markup changes. Not re-run this session: testhh, testcal, testreal (they need the static server on 8765 and a fresh preview build), test4, test5, test8, testripple, testoffline, testpretend, testrename.

## Known gaps and owed items
- Occasion dates under occasion names in the search *suggestions* are not built (the filter's Occasion list has them). Birthdays show no date line.
- Escape inside a filter list closes the whole sheet (back arrow goes back one step).
- Not tested: non-date-tracking saves hiding When and Sort (logic only); a Sim's page opening the viewer.
- Preview and zip not refreshed. Owner hasn't said to publish. Commit descriptions owed when ready.
- Trash soft-deletes photos only; blobs are removed on purge.
- 11 worlds have no scene art (plain teal pin tile). Preteen stage (10–11) is on `ROADMAP.md` Later; so is "Photos, more".
- Reminders: remove `tsconfig.tsbuildinfo` from the GitHub repo; nightly cleanup SQL with pg_cron; Supabase dashboard reminders.
