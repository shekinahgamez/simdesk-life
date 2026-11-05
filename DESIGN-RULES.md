# SimDesk design rules

Read this before drawing or building any screen. Each rule comes from something the owner already told us. If a rule is wrong, change it here first.

## Process
1. Mockup screenshots first (desktop and phone). No code until the screens are approved.
   - Before drawing, check this file and reuse the app's existing approved pieces (calendar picker, filter sheet, sheets and popups). Don't invent a new control for something that already has one.
2. One feature at a time: describe it, get an OK, build it, test it.
3. Show screenshots of the real app as proof. Send images, not interactive links.
4. Don't guess. If something is ambiguous, ask or say which reading was used.
5. Don't publish the preview until asked.

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

## Never
- Never touch the simbase Supabase project (pczvxbuipkeksnpeqehp). SimDesk's is simdesk (pyszlcaaotkituvvpvvw).
- Never put the owner's personal views anywhere on the site.
- Never start another map creation.
