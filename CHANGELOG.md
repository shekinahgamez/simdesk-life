# SimDesk changelog

Newest first. One line per feature, added by whichever thread builds it: thread, date (UTC), files touched. Before re-packing the shared code copy, diff it against the latest copy and make sure nothing earlier disappeared.

## 2026-11-07
- **Quick actions button is a plus** (thread "Add a command bar to SimDesk"). Swapped the phone top bar's lightning bolt for a plus, her pick. `src/components/CommandBar.tsx`, `src/styles/commandbar.css`.
- **Command bar and Quick actions** (thread "Add a command bar to SimDesk"). Desktop Ctrl K / "/" bar with 17 one-word slash commands (including /help), search across Sims, households, lots, clubs and pages, and a phone-only Quick actions sheet from a plus button on Today, Rotation and More. New: `src/lib/commands.ts`, `src/lib/commands.test.ts`, `src/components/CommandBar.tsx`, `src/styles/commandbar.css`, `_handoff/test-scripts/commands/`. Small hooks in: `Shell.tsx` (Search button, lightning button, `CommandHost`), `layers.ts` (`layerCount`), `Rotation.tsx` (`EndTurnDialog` exported), `SimForm.tsx` (`preset`), `WorldsHome.tsx` / `ClubForm.tsx` / `CalendarPage.tsx` (new-item `name`), `main.tsx` (css), `HANDOFF.md`.
- **Household funds** (Household funds thread). `src/lib/money.ts`, `src/pages/money/`, `src/styles/money.css`, hooks in the household page and Save settings.
- **Likes and turn ons** (Likes and turn ons thread). `src/lib/likes.ts`, Sim profile card.

## Before the changelog
- Rotation, Today page, fewer-clicks boards 1 to 10, household filter and gallery, birthdays, worlds on/off, intro, Britechester art (merged in PR #1).
