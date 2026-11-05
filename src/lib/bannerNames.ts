/**
 * Typing a name picks a banner for you ("Winterfest" gets the Christmas one). In-game holiday names count too:
 * Love Day, Harvestfest, Winterfest and New Year's Eve come from The Sims 4: Seasons. You can always pick another.
 */
type Kind = 'holiday' | 'event' | 'trip';

const WORDS: Record<Kind, Record<string, string[]>> = {
  holiday: {
    christmas: ['christmas', 'xmas', 'winterfest', 'winter fest', 'winter festival', 'christmas eve'],
    loveday: ['love day', 'valentine', 'valentines', 'valentines day', 'galentines'],
    hanukkah: ['hanukkah', 'chanukah', 'hannukah'],
    july4: ['july 4', 'july 4th', '4th of july', 'fourth of july', 'july fourth', 'independence day'],
    juneteenth: ['juneteenth'],
    halloween: ['halloween', 'spooky day', 'spooky'],
    thanksgiving: ['thanksgiving', 'harvestfest', 'harvest fest', 'harvest festival', 'friendsgiving'],
    newyear: ['new year', 'new years', 'new years eve', 'nye', 'countdown'],
    easter: ['easter'],
    diwali: ['diwali', 'deepavali'],
    eid: ['eid', 'eid al fitr', 'eid al adha', 'ramadan'],
    lunar: ['lunar new year', 'chinese new year', 'lunar'],
    kwanzaa: ['kwanzaa'],
    mothers: ['mothers day', 'mother day'],
    stpat: ['st patrick', 'st patricks', 'saint patrick', 'saint patricks', 'st pats', 'patricks day'],
    fathers: ['fathers day', 'father day'],
    cinco: ['cinco de mayo', 'cinco'],
    earth: ['earth day'],
    memday: ['memorial day'],
    labor: ['labor day', 'labour day'],
    pride: ['pride'],
    snow: ['snow day'],
    beach: ['beach day'],
  },
  event: {
    wedding: ['wedding', 'bridal', 'engagement'],
    graduation: ['graduation', 'graduate', 'commencement'],
    kids: ['kids party', 'kid party', 'childrens party', 'playdate'],
    cake: ['birthday', 'bday'],
    baby: ['baby shower', 'baby'],
    memorial: ['memorial', 'celebration of life', 'remembrance'],
    house: ['housewarming', 'house warming', 'open house'],
    datenight: ['date night', 'date'],
    gamenight: ['game night', 'board games', 'game day'],
    sleepover: ['sleepover', 'slumber', 'pajama party'],
    funeral: ['funeral', 'wake', 'burial', 'viewing'],
    party: ['party', 'celebration', 'get together'],
  },
  trip: {
    italy: ['italy', 'italian', 'tuscany', 'rome', 'venice', 'florence', 'amalfi'],
    cabin: ['cabin', 'lodge', 'cottage', 'woods'],
    ski: ['ski', 'skiing', 'snowboard', 'mountain', 'mountains', 'alps', 'slopes', 'komorebi'],
    camping: ['camp', 'camping', 'tent', 'glamping', 'campfire'],
    vacation: ['beach', 'island', 'tropical', 'sunset', 'oasis'],
  },
};

const clean = (s: string) => ` ${s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** The banner a name suggests, or null. Longer matches win ("baby shower" over "baby"). */
export function bannerForName(name: string, kind: Kind): string | null {
  const text = clean(name);
  let best: { id: string; len: number } | null = null;
  for (const [id, words] of Object.entries(WORDS[kind])) {
    for (const w of words) {
      if (text.includes(` ${w} `) && (!best || w.length > best.len)) best = { id, len: w.length };
    }
  }
  return best?.id ?? null;
}
