# SimDesk design rules

Read this before drawing or building any screen. Each rule comes from something the owner already told us. If a rule is wrong, change it here first.

## Process
1. Mockup screenshots first, at desktop 1440 wide and iPhone 390 wide, drawn on the latest shared code with real save data. Show the screen as it is now next to the new one. No code until the screens are approved.
   - Before drawing, check this file and reuse the app's existing approved pieces (calendar picker, filter sheet, sheets and popups). Don't invent a new control for something that already has one.
2. One feature at a time: describe it, get an OK, build it, test it.
3. Show screenshots of the real app as proof. Send images, not interactive links.
4. Don't guess. If something is ambiguous, ask or say which reading was used.
5. Don't publish the preview, commit or push until asked.
6. One code copy. Every SimDesk thread builds on the same shared copy and keeps every other thread's changes. Get the latest before editing and put it back when done. Never redraw or rebuild a page from an older copy.
7. Review the whole app, not one area, unless the owner names the area. Say the scope up front.

## Fewer clicks (Nov 6 2026)
The owner said SimDesk was "beautiful but everything takes a million clicks". Every new screen is checked for this before it is shown. Count the taps for the everyday job, now and new, and put the counts on the mockup.
- **Edit in place.** Tapping a row on a profile edits just that field. A card's pencil edits just that card (for example a club's members, rules or details). The big Edit button stays for editing everything.
- **Autosave with Undo.** Small edits save as soon as the popover or sheet closes and show a toast with Undo. No Save button for one field.
- **Pick right in the list.** A cell in a list (like a Sim's household) opens a popover with search and a "New …" row. No trip to another page.
- **Select mode for bulk.** Lists that need sorting get a Select button: tick rows or cards, then one action in a bottom sheet (phone) or bar (desktop).
- **"Save and add another"** on forms you fill in many times in a row (relationships, Sims).
- **The common choice first, as one tap.** Example: housemates come first in the relationship picker. Rare options sit behind one link.
- **Today is the home page.** It shows the date with Next day, Jump ahead and Go back, Playing now (when Rotation is on), "To sort" counts that open filtered lists, save-wide Coming up and Jump back in. No deck of section cards in between.
- **Compact pages.** A page should fit the job without long scrolling. The Sim profile is a small portrait with one fact line, not a wall of fact tiles. Merge cards that hold one or two lines each.
- **Rare and risky actions go in the ⋯ menu** (Delete, Play now), not as big buttons.
- Don't trade a click for something the owner needs to see. Lot photos stay big ("lots are hard to view small").

## Buttons and tap sizes (Nov 6 2026)
- Buttons are **40px** tall. Small buttons and links are **32px**. Same on desktop and iPhone. Nothing is 44px or bigger (this replaces the old iPad 44px rule). A tiny ✕ still gets a 32px tap area.
- **One filled button per screen or sheet.** Everything else is plain or outlined.
- **No teal buttons.** Teal is the Worlds color, not a button color.
- Buttons say what happens ("End turn", "Restore as a new save"), not "OK" or "Done" when a verb fits.
- Icons beat text labels where the icon is clear (the owner has autism and ADHD). Keep the label as `aria-label` or a short word next to it.

## Lists and filters
- **Never use pills or chips for names of Sims, worlds, lots or anything that can grow.** A save can have hundreds of Sims. Use a dropdown with a search box, checkboxes, and a count per row.
- Pills are fine only for a small fixed set (3 to 6 options that never grow), like "All / Living / Passed".
- A pill is also fine when it points at one thing, at most one per row, like the club an activity is aimed at ("Be Nice → Night Owls"). Never a row of them, and never for something you pick many of.
- Filters are dropdown buttons in one row: "Sims", "When", "From". When a filter is on, its button tints and shows a count ("Sims · 2"), and a "Clear" link appears.
- On phone, a filter opens a bottom sheet with a "Show N photos" button. On desktop it is a popover.
- Long lists always get search.

## Layout
- Don't leave empty rows or big gaps. If a group has one or two items, let them fill the width.
- Use the space. Cards flow in columns on desktop and stack on phone.
- Light and airy. No heavy fills. Color is a subtle tint of the section's own color (for example `--worlds-tint` at 20%).
- Gray means empty or inactive. Empty slots use a dashed outline, no fill.
- Titles and sub-titles must never look the same. A neighborhood heading and an item in it need clearly different size and weight.
- Don't put an icon in front of a name if it makes the name look nested under something else.

## Dates
- When something has a game date and a real date, one leads and the other is small gray text. The game date leads. If there is no game date, the added day leads alone.
- **Every game-date picker uses the SimDesk calendar picker** (`DateField` for one day, `RangeField` for a span, in `src/components/SeasonPicker.tsx`): one season at a time, the season's scene on top, tap a day. Never a dropdown of seasons, a list of dates, a text box or the browser's date input. This includes filters: a "When" filter opens the calendar picker as a range (tap the first day, then the last; same day for one day).
- A range that covers a whole season reads as the season ("Spring · Year 1"). Otherwise "Spring 3 → Spring 12 · Year 1".

## Wording
- Lean, in SimDesk's voice. Friendly, short. No filler hints that repeat what's obvious.
- No "Plot Matcher", no map art, no EA art.

## Art and type
- **Never draw or generate the owner's Sims.** No drawn portraits, avatars or placeholder people. Use real in-game photos, initials or icons only.
- **No plumbob** anywhere (it's trademarked). No other Sims trademarks.
- **No rounded fonts.**
- No sound. The intro is animation only.

## Never
- Never touch the simbase Supabase project (pczvxbuipkeksnpeqehp). SimDesk's is simdesk (pyszlcaaotkituvvpvvw).
- Never put the owner's personal views anywhere on the site.
- Never start another map creation. Maps are shelved for v1 (they need an artist).
