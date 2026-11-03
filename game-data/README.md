# Game data

SimDesk's game data (packs, traits, aspirations, occults, traditions, worlds, neighborhoods, lots,
lot types, life stages) is built into the app from the workbook in this folder.

## To update it

1. Edit `simdesk-game-data.xlsx` (or fill in a copy of `new-pack-template.xlsx` for a new pack).
2. Run `npm run import-workbook`, or for a new-pack file:
   `npm run import-workbook -- game-data/simdesk-game-data.xlsx game-data/my-new-pack.xlsx`
   (the main workbook always goes first). Or send the files to Claude.
3. Upload. The site rebuilds and the new data is live in about a minute.

The import prints warnings for misspelled pack, world or neighborhood names. A tab with no rows
never wipes out a list; the old list is kept.

## fixes.json

Owner-approved corrections applied on top of the workbook: which lot types are locked, lots added or
moved, size fixes and the aspiration checks. Everything else is in the workbook.

## Lot types

Only lots the game won't let you change keep their lot type (apartments, secret lots, career
buildings, the high school and the other special lots listed in `fixes.json`). Every other lot starts
with no lot type, so players set their own. The game's lot names are kept for reference.
