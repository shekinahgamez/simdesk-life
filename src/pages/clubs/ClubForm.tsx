import { useMemo, useState, type ReactNode } from 'react';
import { CaretLeft, CaretRight, Check, Plus, Trash, X } from '@phosphor-icons/react';
import { Confirm, Field, Modal, SearchBox, TextInput, toast } from '../../components/ui';
import {
  activitySuggestions, admissionLabel, BLANK_CLUB, canJoinClub, cleanClub, clubCountOf, MAX_ACTIVITIES, MAX_CLUBS_PER_SIM, MAX_REQUIREMENTS,
  PERK_KINDS, perkKindLabel, REQ_CATS, reqCatLabel, withMembers, type Activity, type ClubData, type PerkKind, type ReqCat,
} from '../../lib/clubs';
import { lotTypeName } from '../../lib/lots';
import { normalize, plural } from '../../lib/text';
import { useStore } from '../../lib/sync/react';
import { stageName } from '../../lib/time';
import { SimAvatar } from '../sims/shared';
import { AGE_STAGES, traitNames, type ClubsCtx } from './shared';

type View =
  | { t: 'form' } | { t: 'members' } | { t: 'leader' } | { t: 'place' }
  | { t: 'aim'; list: 'encouraged' | 'banned'; i: number }
  | { t: 'reqcat' } | { t: 'reqval'; cat: ReqCat } | { t: 'perk' };
type ActKey = 'encouraged' | 'banned';

/** A row you tap to open a list: the label, what's chosen, and "Change". */
function PickRow({ label, count, text, empty, action, onClick, disabled }: { label: string; count?: string; text: string; empty?: boolean; action?: string; onClick(): void; disabled?: boolean }) {
  return (
    <div className="field">
      <span className="label">{label}{count && <span className="cnt">{count}</span>}</span>
      <button type="button" className="ph-fld" disabled={disabled} aria-label={`${label}: ${text}${action ? `. ${action}` : ''}`} onClick={onClick}>
        <span className={empty ? 'ph-fld-empty' : ''}>{text}</span>{action && <small>{action}</small>}
      </button>
    </div>
  );
}

export type ClubPart = 'members' | 'rules' | 'details';
const PART_TITLE: Record<ClubPart, string> = { members: 'Members', rules: 'Rules', details: 'Details' };

/**
 * The New club / Edit club window. One window, many screens: the form, and a list for each thing you pick.
 * With `part`, it edits just that part of a club (from the pencil on its card) and saves when you close it, with Undo.
 * `pickMembers` opens straight on the member list.
 */
export function ClubForm({ ctx, id, onClose, onSaved, onDeleted, part, pickMembers }: {
  ctx: ClubsCtx; id: string | null; onClose(): void; onSaved(id: string): void; onDeleted?(): void; part?: ClubPart; pickMembers?: boolean;
}) {
  const store = useStore();
  const existing = id ? ctx.byId.get(id) : undefined;
  const [start] = useState<ClubData>(() => existing?.club ?? BLANK_CLUB);
  const [f, setF] = useState<ClubData>(start);
  const [view, setView] = useState<View>(pickMembers ? { t: 'members' } : { t: 'form' });
  const [q, setQ] = useState('');
  const [tried, setTried] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [placeTab, setPlaceTab] = useState<'lot' | 'type' | 'none'>(start.place?.kind ?? 'lot');
  const [draftText, setDraftText] = useState('');
  const [draftSel, setDraftSel] = useState<string[]>([]);
  const [draftKind, setDraftKind] = useState<PerkKind>('status');
  const [pending, setPending] = useState(false); // saved once; ignore double taps
  const others = useMemo(() => ctx.rows.filter((r) => r.id !== id), [ctx.rows, id]);
  const dirty = JSON.stringify(f) !== JSON.stringify(start);

  const go = (v: View) => { setQ(''); setView(v); };
  const toForm = () => go({ t: 'form' });
  const set = (patch: Partial<ClubData>) => setF((x) => ({ ...x, ...patch }));
  const has = (label: string) => !q.trim() || normalize(label).includes(normalize(q));

  // ----- people -----
  const memberRows = useMemo(() => {
    const row = (sid: string) => ({ id: sid, name: ctx.nameOf(sid), note: ctx.householdOf(sid) });
    const chosen = f.members.map(row);
    const rest = [...ctx.sims.keys()].filter((sid) => !f.members.includes(sid) && !ctx.sims.get(sid)!.deceased && canJoinClub(ctx.stageFor(sid))).map(row)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { chosen, rest };
  }, [f.members, ctx]);
  const full = (sid: string) => clubCountOf(ctx.rows, sid, id) >= MAX_CLUBS_PER_SIM;
  const toggleMember = (sid: string) => setF((x) => withMembers(x, x.members.includes(sid) ? x.members.filter((m) => m !== sid) : [...x.members, sid]));
  const namesText = (ids: string[]) => (ids.length > 3 ? `${ids.slice(0, 3).map(ctx.firstOf).join(', ')} +${ids.length - 3}` : ids.map(ctx.firstOf).join(', '));

  // ----- place -----
  const placeText = f.place ? [ctx.placeOf(f.place).text, f.place.kind === 'type' ? 'lot type' : ctx.placeOf(f.place).sub].filter(Boolean).join(' · ') : '';
  const lotList = useMemo(() => ctx.lots.rows.map((r) => ({ id: r.id, name: r.lot.name || 'Unnamed lot', sub: ctx.lots.worldName(r.world) })).sort((a, b) => a.name.localeCompare(b.name)), [ctx.lots]);
  const typeList = useMemo(() => {
    const l = ctx.info.avail.lotTypes.filter((t) => t.kind === 'community').map((t) => ({ id: t.id, name: t.name }));
    if (f.place?.kind === 'type' && !l.some((t) => t.id === f.place!.id)) l.push({ id: f.place.id, name: `${lotTypeName(f.place.id)} (pack is off)` });
    return l.sort((a, b) => a.name.localeCompare(b.name));
  }, [ctx.info, f.place]);

  // ----- activities -----
  const setAct = (list: ActKey, i: number, patch: Partial<Activity>) => setF((x) => ({ ...x, [list]: x[list].map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const addAct = (list: ActKey) => { setF((x) => (x[list].length >= MAX_ACTIVITIES ? x : { ...x, [list]: [...x[list], { text: '', club: null }] })); setFocus(`${list}-${f[list].length}`); };
  const dropAct = (list: ActKey, i: number) => setF((x) => ({ ...x, [list]: x[list].filter((_, j) => j !== i) }));
  const clubName = (cid: string | null) => (cid ? ctx.byId.get(cid)?.club.name ?? '' : '');

  const activities = (list: ActKey, title: string) => (
    <div className="field">
      <span className="label">{title}<span className="cnt">{f[list].length} of {MAX_ACTIVITIES}</span></span>
      {f[list].map((a, i) => {
        const key = `${list}-${i}`;
        const target = clubName(a.club);
        const sug = focus === key ? activitySuggestions(ctx.rows, id, a.text) : [];
        return (
          <div key={key} className="club-act">
            <div className="club-act-row">
              <input className="input" value={a.text} maxLength={40} aria-label={`${title} ${i + 1}`} placeholder="Like Read" autoCapitalize="words" autoCorrect="off" spellCheck={false}
                onFocus={() => setFocus(key)} onChange={(e) => setAct(list, i, { text: e.target.value })} />
              <button type="button" className="club-x" aria-label={`Remove ${a.text || 'activity'}`} onClick={() => dropAct(list, i)}><X size={16} weight="bold" /></button>
            </div>
            {sug.length > 0 && (
              <div className="club-sug" role="listbox" aria-label="Suggestions" onMouseDown={(e) => e.preventDefault()}>
                {sug.map((s) => <button key={s.text} type="button" role="option" aria-selected="false" onClick={() => setAct(list, i, { text: s.text })}>{s.text}<small>used in {s.from}</small></button>)}
              </div>
            )}
            {target ? (
              <button type="button" className="ph-fld club-aim" aria-label={`Aimed at: ${target}. Change`} onClick={() => go({ t: 'aim', list, i })}>
                <span><span className="club-aim-l">Aimed at · </span>{target}</span><small>Change</small>
              </button>
            ) : focus === key && a.text.trim() && others.length > 0 ? (
              <button type="button" className="btn sm ghost club-aim-add" onClick={() => go({ t: 'aim', list, i })}>Aim at a club</button>
            ) : null}
          </div>
        );
      })}
      {f[list].length < MAX_ACTIVITIES && <button type="button" className="btn sm club-add" onClick={() => addAct(list)}><Plus size={14} weight="bold" /> Add activity</button>}
    </div>
  );

  // ----- save / delete -----
  const save = () => {
    setTried(true);
    if (!f.name.trim() || pending) return;
    setPending(true);
    const data = cleanClub(withMembers(f, f.members), id, new Set(ctx.rows.map((r) => r.id)));
    const newId = store.put('club', data, id ?? undefined);
    if (part && id) {
      const before = start;
      toast(`${PART_TITLE[part]} saved`, { label: 'Undo', run: () => store.put('club', before, id) });
    } else toast(id ? 'Saved' : `${data.name} added`);
    onSaved(newId);
  };

  const show = (p: ClubPart) => !part || part === p;
  const form = (
    <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      {!part && <>
      <Field label="Club name" hint={tried && !f.name.trim() ? <span className="field-err">Give it a name.</span> : undefined}>
        {(fid) => <TextInput kind="name" id={fid} value={f.name} maxLength={40} placeholder="Like Page Turners" onChange={(e) => set({ name: e.target.value })} />}
      </Field>
      <Field label="Description">
        {(fid) => <textarea id={fid} className="textarea" rows={2} maxLength={200} value={f.description} placeholder="What the club is about" onChange={(e) => set({ description: e.target.value })} />}
      </Field>
      </>}
      {show('details') && <div className="field">
        <span className="label">Who can join</span>
        <div className="ph-seg" role="group" aria-label="Who can join">
          {(['open', 'invite'] as const).map((a) => <button key={a} type="button" aria-pressed={f.admission === a} onClick={() => set({ admission: a })}>{admissionLabel(a)}</button>)}
        </div>
      </div>}
      {show('members') && <>
      <PickRow label="Members" text={f.members.length ? namesText(f.members) : 'None yet'} empty={!f.members.length} action={f.members.length ? 'Change' : 'Add'} onClick={() => go({ t: 'members' })} />
      <PickRow label="Leader" text={f.members.length ? (f.leader ? ctx.nameOf(f.leader) : 'Pick a leader') : 'Add members first'} empty={!f.members.length} action={f.members.length ? 'Change' : undefined} disabled={!f.members.length} onClick={() => go({ t: 'leader' })} />
      </>}
      {show('details') && <PickRow label="Meets at" text={f.place ? placeText : 'No specific place'} empty={!f.place} action={f.place ? 'Change' : 'Choose'} onClick={() => { setPlaceTab(f.place?.kind ?? 'lot'); go({ t: 'place' }); }} />}
      {show('rules') && <>
      {activities('encouraged', 'Encouraged activities')}
      {activities('banned', 'Banned activities')}
      </>}
      {show('details') && <>
      <div className="field">
        <span className="label">Requirements<span className="cnt">{f.requirements.length} of {MAX_REQUIREMENTS}</span></span>
        {f.requirements.map((r, i) => (
          <div key={i} className="ph-fld club-chip" role="group" aria-label={`${reqCatLabel(r.cat)}: ${r.value}`}>
            <span><span className="club-aim-l">{reqCatLabel(r.cat)} · </span>{r.value}</span>
            <button type="button" className="club-x flat" aria-label={`Remove ${reqCatLabel(r.cat)} ${r.value}`} onClick={() => set({ requirements: f.requirements.filter((_, j) => j !== i) })}><X size={16} weight="bold" /></button>
          </div>
        ))}
        {f.requirements.length < MAX_REQUIREMENTS && <button type="button" className="btn sm club-add" onClick={() => go({ t: 'reqcat' })}><Plus size={14} weight="bold" /> Add a requirement</button>}
      </div>
      <div className="field">
        <span className="label">Perks</span>
        {f.perks.map((p, i) => (
          <div key={i} className="ph-fld club-chip" role="group" aria-label={`${perkKindLabel(p.kind)}: ${p.text}`}>
            <span><span className="club-aim-l">{perkKindLabel(p.kind)} · </span>{p.text}</span>
            <button type="button" className="club-x flat" aria-label={`Remove ${p.text}`} onClick={() => set({ perks: f.perks.filter((_, j) => j !== i) })}><X size={16} weight="bold" /></button>
          </div>
        ))}
        <button type="button" className="btn sm club-add" onClick={() => { setDraftKind('status'); setDraftText(''); go({ t: 'perk' }); }}><Plus size={14} weight="bold" /> Add a perk</button>
      </div>
      <Field label="Notes">
        {(fid) => <textarea id={fid} className="textarea" rows={3} value={f.notes} placeholder="Anything worth remembering…" onChange={(e) => set({ notes: e.target.value })} />}
      </Field>
      </>}
    </form>
  );

  // ----- the list screens -----
  const search = (placeholder: string) => <div className="ph-pk-search"><SearchBox value={q} onChange={setQ} placeholder={placeholder} /></div>;
  const none = (text: string) => <p className="muted ph-pk-none">{text}</p>;
  const tickOf = (on: boolean) => <span className="ph-pk-tick" aria-hidden="true">{on && <Check size={18} weight="bold" />}</span>;
  const line = (key: string, label: string, sub: string, on: boolean, onClick: () => void) => (
    <button key={key} type="button" role="option" aria-selected={on} className="ph-pk-opt" onClick={onClick}>
      <span className="ph-pk-ot"><span className="ph-pk-t">{label}</span>{sub && <span className="ph-pk-sub">{sub}</span>}</span>{tickOf(on)}
    </button>
  );

  const membersView = (() => {
    const sim = (r: { id: string; name: string; note: string }, on: boolean) => {
      const blocked = !on && full(r.id);
      return (
        <button key={r.id} type="button" role="checkbox" aria-checked={on} aria-label={r.name} disabled={blocked} className="ph-pk-sim" onClick={() => toggleMember(r.id)}>
          <span className={`ph-cb ${on ? 'on' : ''}`} aria-hidden="true" />
          {ctx.sims.has(r.id) ? <SimAvatar sim={ctx.sims.get(r.id)!} size={30} /> : <span className="sim-avatar initials" style={{ width: 30, height: 30 }} aria-hidden="true" />}
          <span className="ph-pk-t">{r.name}</span><span className="ph-pk-n">{blocked ? `In ${MAX_CLUBS_PER_SIM} clubs` : r.note}</span>
        </button>
      );
    };
    const chosen = memberRows.chosen.filter((r) => has(r.name));
    const rest = memberRows.rest.filter((r) => has(r.name));
    return (
      <div className="ph-pk">
        {search('Search Sims')}
        <div className="ph-pk-list">
          {chosen.length > 0 && <div className="ph-lbl">Selected</div>}
          {chosen.map((r) => sim(r, true))}
          {rest.length > 0 && <div className="ph-lbl">Everyone</div>}
          {rest.map((r) => sim(r, false))}
          {chosen.length + rest.length === 0 && none(ctx.sims.size ? `No Sim called “${q.trim()}”.` : 'Add some Sims first.')}
        </div>
      </div>
    );
  })();

  const leaderView = (
    <div className="ph-pk">
      <div className="ph-pk-list" role="listbox" aria-label="Leader">
        <div className="ph-lbl">From the members</div>
        {f.members.map((sid) => (
          <button key={sid} type="button" role="option" aria-selected={f.leader === sid} className="ph-pk-sim" onClick={() => { set({ leader: sid }); toForm(); }}>
            {ctx.sims.has(sid) ? <SimAvatar sim={ctx.sims.get(sid)!} size={30} /> : <span className="sim-avatar initials" style={{ width: 30, height: 30 }} aria-hidden="true" />}
            <span className="ph-pk-t">{ctx.nameOf(sid)}</span><span className="ph-pk-n">{ctx.householdOf(sid)}</span>{tickOf(f.leader === sid)}
          </button>
        ))}
      </div>
    </div>
  );

  const placeView = (
    <div className="ph-pk">
      <div className="ph-seg three" role="group" aria-label="Meets at">
        {([['lot', 'A lot'], ['type', 'Lot type'], ['none', 'No place']] as const).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={placeTab === v} onClick={() => { setPlaceTab(v); setQ(''); if (v === 'none') set({ place: null }); }}>{l}</button>
        ))}
      </div>
      {placeTab === 'lot' && <>
        {search('Search your lots')}
        <div className="ph-pk-list" role="listbox" aria-label="Lots">
          {lotList.filter((l) => has(l.name)).map((l) => line(l.id, l.name, l.sub, f.place?.kind === 'lot' && f.place.id === l.id, () => { set({ place: { kind: 'lot', id: l.id } }); toForm(); }))}
          {!lotList.some((l) => has(l.name)) && none(lotList.length ? `No lot called “${q.trim()}”.` : 'You haven’t added any lots yet.')}
        </div>
      </>}
      {placeTab === 'type' && <>
        {search('Search lot types')}
        <div className="ph-pk-list" role="listbox" aria-label="Lot types">
          {typeList.filter((t) => has(t.name)).map((t) => line(t.id, t.name, '', f.place?.kind === 'type' && f.place.id === t.id, () => { set({ place: { kind: 'type', id: t.id } }); toForm(); }))}
          {!typeList.some((t) => has(t.name)) && none(`No lot type called “${q.trim()}”.`)}
        </div>
      </>}
      {placeTab === 'none' && <p className="ph-pk-none">No specific place. The club meets wherever the leader is.</p>}
    </div>
  );

  const aimView = (v: Extract<View, { t: 'aim' }>) => (
    <div className="ph-pk">
      {search('Search your clubs')}
      <div className="ph-pk-list" role="listbox" aria-label="Clubs">
        {others.length > 0 && <div className="ph-lbl">Other clubs</div>}
        {others.filter((r) => has(r.club.name)).map((r) => line(r.id, r.club.name, plural(r.club.members.length, 'member'), f[v.list][v.i]?.club === r.id, () => { setAct(v.list, v.i, { club: r.id }); toForm(); }))}
        {others.length === 0 && none('You have no other clubs yet.')}
      </div>
    </div>
  );

  const reqCatView = (
    <div className="ph-pk">
      <div className="ph-pk-list">
        <div className="ph-lbl">Who can join, by<span className="cnt">{f.requirements.length} of {MAX_REQUIREMENTS} used</span></div>
        {REQ_CATS.map((c) => (
          <button key={c.id} type="button" className="ph-pk-opt" onClick={() => { setDraftText(''); setDraftSel([]); go({ t: 'reqval', cat: c.id }); }}>
            <span className="ph-pk-ot"><span className="ph-pk-t">{c.label}</span></span><span className="ph-pk-tick club-chev-t" aria-hidden="true"><CaretRight size={16} weight="bold" /></span>
          </button>
        ))}
      </div>
    </div>
  );

  const traits = useMemo(() => traitNames(ctx.info), [ctx.info]);
  const reqValView = (cat: ReqCat) => {
    if (cat === 'age') {
      return (
        <div className="ph-pk"><div className="ph-pk-list">
          {AGE_STAGES.map((s) => {
            const on = draftSel.includes(s.id);
            return (
              <button key={s.id} type="button" role="checkbox" aria-checked={on} aria-label={s.label} className="ph-pk-sim" onClick={() => setDraftSel(on ? draftSel.filter((x) => x !== s.id) : [...draftSel, s.id])}>
                <span className={`ph-cb ${on ? 'on' : ''}`} aria-hidden="true" /><span className="ph-pk-t">{s.label}</span>
              </button>
            );
          })}
        </div></div>
      );
    }
    if (cat === 'trait') {
      return (
        <div className="ph-pk">
          {search('Search traits')}
          <div className="ph-pk-list" role="listbox" aria-label="Traits">
            {traits.filter(has).map((t) => line(t, t, '', draftText === t, () => setDraftText(t)))}
            {!traits.some(has) && none(`No trait called “${q.trim()}”.`)}
          </div>
        </div>
      );
    }
    return (
      <div className="ph-pk">
        <Field label={reqCatLabel(cat)}>
          {(fid) => <TextInput id={fid} value={draftText} maxLength={60} autoFocus placeholder={cat === 'skill' ? 'Like Cooking level 2' : cat === 'career' ? 'Like Medical' : cat === 'marital' ? 'Like Single' : 'Like Rich'} onChange={(e) => setDraftText(e.target.value)} />}
        </Field>
      </div>
    );
  };
  const reqValue = (cat: ReqCat) => (cat === 'age' ? AGE_STAGES.filter((s) => draftSel.includes(s.id)).map((s) => stageName(s.id)).join(', ') : draftText.trim());
  const addReq = (cat: ReqCat) => { const value = reqValue(cat); if (!value) return; set({ requirements: [...f.requirements, { cat, value }] }); toForm(); };

  const perkView = (
    <div className="ph-pk">
      <div className="field"><span className="label">Kind</span>
        <div className="ph-seg" role="group" aria-label="Kind">
          {PERK_KINDS.map((k) => <button key={k.id} type="button" aria-pressed={draftKind === k.id} onClick={() => setDraftKind(k.id)}>{k.label}</button>)}
        </div>
      </div>
      <Field label="Perk">{(fid) => <TextInput id={fid} value={draftText} maxLength={60} autoFocus placeholder="Like Secret handshake" onChange={(e) => setDraftText(e.target.value)} />}</Field>
    </div>
  );
  const addPerk = () => { if (!draftText.trim()) return; set({ perks: [...f.perks, { kind: draftKind, text: draftText.trim() }] }); toForm(); };

  // ----- the window -----
  const sub = (text: string, back: View, extra?: ReactNode) => (
    <span className="ph-ft">
      <button type="button" className="ph-ft-back" aria-label="Back" onClick={() => go(back)}><CaretLeft size={22} weight="bold" /></button>
      <span>{text}</span>{extra}
    </span>
  );
  const formBack: View = { t: 'form' };
  const title: ReactNode = view.t === 'form' ? (part ? PART_TITLE[part] : id ? 'Edit club' : 'New club')
    : view.t === 'members' ? sub('Members', formBack, <span className="cnt ph-ft-n">{f.members.length}</span>)
      : view.t === 'leader' ? sub('Leader', formBack)
        : view.t === 'place' ? sub('Meets at', formBack, f.place ? <button type="button" className="ph-ft-clear" onClick={() => { set({ place: null }); toForm(); }}>Clear</button> : undefined)
          : view.t === 'aim' ? sub('Aimed at', formBack, f[view.list][view.i]?.club ? <button type="button" className="ph-ft-clear" onClick={() => { setAct(view.list, view.i, { club: null }); toForm(); }}>Clear</button> : undefined)
            : view.t === 'reqcat' ? sub('Add a requirement', formBack)
              : view.t === 'reqval' ? sub(reqCatLabel(view.cat), { t: 'reqcat' })
                : sub('Add a perk', formBack);
  const body = view.t === 'form' ? form : view.t === 'members' ? membersView : view.t === 'leader' ? leaderView : view.t === 'place' ? placeView
    : view.t === 'aim' ? aimView(view) : view.t === 'reqcat' ? reqCatView : view.t === 'reqval' ? reqValView(view.cat) : perkView;

  // Editing one part: closing saves (there's Undo), so there's no Cancel.
  const close = () => (part && dirty ? save() : onClose());
  const footer = view.t === 'form' && part ? <button type="button" className="btn primary" onClick={close}>Done</button>
    : view.t === 'form'
    ? (close: () => void) => (
      <>
        {existing && <button type="button" className="btn ghost danger" style={{ marginRight: 'auto' }} onClick={() => setDel(true)}><Trash size={16} weight="duotone" /> Delete</button>}
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <button type="button" className="btn primary" onClick={save}>{id ? 'Save' : 'Add club'}</button>
      </>
    )
    : view.t === 'members' ? <button type="button" className="btn primary" onClick={pickMembers ? close : toForm}>{f.members.length ? `Done · ${f.members.length} selected` : 'Done'}</button>
      : view.t === 'reqval' ? <button type="button" className="btn primary" disabled={!reqValue(view.cat)} onClick={() => addReq(view.cat)}>Add requirement</button>
        : view.t === 'perk' ? <button type="button" className="btn primary" disabled={!draftText.trim()} onClick={addPerk}>Add perk</button>
          : undefined;

  return (
    <Modal title={title} onClose={part ? close : onClose} dirty={part ? false : dirty} autoFocus={false} className="pinned club-form ph-modal" footer={footer}>
      {body}
      {del && (
        <Confirm title="Delete this club?" text="It goes to Trash for 7 days. Rules in other clubs aimed at it stop pointing at it." onCancel={() => setDel(false)}
          actions={[{ label: 'Keep it', run: () => setDel(false) }, { label: 'Delete', kind: 'danger', run: () => { setDel(false); store.moveToTrash(id!, f.name || 'Club'); onDeleted?.(); onClose(); } }]} />
      )}
    </Modal>
  );
}
