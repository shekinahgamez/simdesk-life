import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus, Star, Storefront, Trash, X } from '@phosphor-icons/react';
import { CheckList, Dropdown, FilterBar, FilterButton } from '../../components/pieces';
import { AutoText, Confirm, Field, Modal, TextInput, toast } from '../../components/ui';
import {
  addActivity, addReading, BLANK_BUSINESS, businessRows, CRITERIA, criterionOf, EXTRAS, FEES, fmt, guessSystem, kindList, lastChange, lifetimeOf, MAX_ACTIVITIES,
  PRICES, priceText, removeRule, setRule, setStaff, setStart, showStartNote, signed, staffIds, SYSTEMS, systemLabel, type BusinessData, type BusinessRow, type CriterionId, type Fee,
  type Rule, type System,
} from '../../lib/businesses';
import { go, savePath } from '../../lib/router';
import { moduleOn, saveData } from '../../lib/saves';
import { useRecords, useStore } from '../../lib/sync/react';
import type { SaveRow } from '../../lib/sync/types';
import { normalize, plural } from '../../lib/text';
import { useIsPhone } from '../../lib/useIsPhone';
import { SimAvatar } from '../sims/shared';
import { SimChecklist } from '../storylines/forms';
import { useStories, type StoriesCtx } from '../storylines/shared';

const href = (save: SaveRow, tail = '') => savePath(save.id, `businesses${tail}`);
const Icon = ({ size = 'md' }: { size?: 'md' | 'lg' }) => <span className={`obj businesses ${size === 'lg' ? 'lg' : ''}`} aria-hidden="true"><Storefront size={size === 'lg' ? 24 : 16} weight="duotone" /></span>;
const asRec = (b: BusinessData) => b as unknown as Record<string, unknown>;
const nowIso = () => new Date().toISOString();

/** Five stars. Tapping the current rating clears it. */
export function Stars({ n, onChange, size = 18 }: { n: number; onChange?(v: number): void; size?: number }) {
  return (
    <span className="bz-stars" role={onChange ? 'group' : 'img'} aria-label={`Rating ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const s = <Star size={size} weight={i <= n ? 'fill' : 'regular'} aria-hidden="true" />;
        return onChange
          ? <button key={i} type="button" className={`bz-star ${i <= n ? 'on' : ''}`} aria-label={`${i} star${i > 1 ? 's' : ''}`} aria-pressed={i <= n} onClick={() => onChange(i === n ? 0 : i)}>{s}</button>
          : <span key={i} className={`bz-star ${i <= n ? 'on' : ''}`}>{s}</span>;
      })}
    </span>
  );
}

function useBiz(save: SaveRow) {
  const recs = useRecords('business');
  const ctx = useStories(save);
  const kinds = kindList(saveData(save).bizKinds);
  return useMemo(() => ({ rows: businessRows(recs), ctx, kinds }), [recs, ctx, kinds]);
}
type B = ReturnType<typeof useBiz>;

/** The Businesses section: the list and one business's page. */
export function BusinessesPage({ save, rest }: { save: SaveRow; rest: string[] }) {
  const d = saveData(save);
  if (!moduleOn(d, 'venues')) {
    return (
      <div className="empty" style={{ margin: '40px auto', maxWidth: 480 }}>
        <Icon size="lg" />
        <h2 style={{ fontSize: 18, margin: 0 }}>Businesses is off for this save</h2>
        <p>Turn it on in Save settings and it shows up here.</p>
        <a className="btn primary" href={savePath(save.id, 'settings')}>Open Save settings</a>
      </div>
    );
  }
  if (rest[0]) return <BusinessOne key={rest[0]} save={save} id={rest[0]} />;
  return <BusinessList save={save} />;
}

// ---------- list ----------
function BusinessList({ save }: { save: SaveRow }) {
  const B = useBiz(save);
  const phone = useIsPhone();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [adding, setAdding] = useState(false);
  const shown = B.rows.filter((r) => (!kind || r.b.kind === kind) && (!q.trim() || normalize(r.b.name).includes(normalize(q))));
  const staffTotal = B.rows.reduce((n, r) => n + r.b.staff.length, 0);
  const btn = <button type="button" className="btn primary" onClick={() => setAdding(true)}><Plus size={16} weight="bold" /> New business</button>;
  const usedKinds = [...new Set(B.rows.map((r) => r.b.kind).filter(Boolean))];
  const filters = B.rows.length > 1 && (
    <FilterBar search={q} onSearch={setQ} searchLabel="Search businesses" active={!!kind || !!q} onClear={() => { setKind(''); setQ(''); }}>
      {usedKinds.length > 1 && <FilterButton label="Kind" count={kind ? 1 : 0}>{(close) => <CheckList single options={usedKinds.map((k) => ({ id: k, label: k }))} value={kind ? [kind] : []} onChange={(v) => { setKind(v[0] === kind ? '' : (v[0] ?? '')); close(); }} />}</FilterButton>}
    </FilterBar>
  );
  const row = (r: BusinessRow) => {
    const b = r.b;
    const life = lifetimeOf(b);
    const ch = lastChange(b);
    return (
      <a key={r.id} className="bz-row" href={href(save, `/${r.id}`)}>
        <Icon />
        <span className="lg-gt"><b>{b.name || 'Unnamed business'}</b><small className="muted">{[b.kind, systemLabel(b.system)].filter(Boolean).join(' · ')}{!phone && B.ctx.hh.nameOf(b.owner) ? ` · ${B.ctx.hh.nameOf(b.owner)}` : ''}</small></span>
        {!phone && <span className="bz-c muted">{plural(b.staff.length, 'staff', 'staff')}</span>}
        <span className="bz-c">{b.rating ? <Stars n={b.rating} size={16} /> : <span className="muted small">Not rated</span>}</span>
        {!phone && <span className="bz-c muted">{priceText(b.price)}</span>}
        <span className="bz-c bz-money">{life !== null ? <><b>{fmt(life)}</b>{ch !== null && <small className={ch >= 0 ? 'bz-up' : 'bz-down'}>{signed(ch)}</small>}</> : <span className="muted small">No money yet</span>}</span>
        <CaretRight size={16} weight="bold" className="muted" aria-hidden="true" />
      </a>
    );
  };
  const body = B.rows.length ? (shown.length ? <div className="lg-list">{shown.map(row)}</div> : <p className="muted">No business matches.</p>) : (
    <div className="empty" style={{ margin: '24px auto', maxWidth: 460 }}>
      <Icon size="lg" />
      <h2 style={{ fontSize: 18, margin: 0 }}>No businesses yet</h2>
      <p>Restaurants, shops, vet clinics, bars. Add one and attach its owner and staff.</p>
    </div>
  );
  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 18 }}>
      {phone ? <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><h1 className="m-h1" style={{ paddingTop: 6 }}>Businesses</h1>{btn}</div> : (
        <div className="page-head"><div className="row" style={{ gap: 14, alignItems: 'flex-start' }}><Icon size="lg" /><div><h1>Businesses</h1><div className="sub">{B.rows.length ? `${plural(B.rows.length, 'business', 'businesses')} · ${staffTotal} staff` : 'Owners, staff and money'}</div></div></div>{btn}</div>
      )}
      {filters}
      {body}
      {adding && <NewBusiness save={save} B={B} onClose={() => setAdding(false)} onMade={(id) => { setAdding(false); go(href(save, `/${id}`)); }} />}
    </div>
  );
}

// ---------- new ----------
function NewBusiness({ save, B, onClose, onMade }: { save: SaveRow; B: B; onClose(): void; onMade(id: string): void }) {
  const store = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState(B.kinds[0] ?? '');
  const [system, setSystem] = useState<System>(guessSystem(B.kinds[0] ?? ''));
  const [owner, setOwner] = useState('');
  const [editKinds, setEditKinds] = useState(false);
  const make = () => {
    const n = name.trim();
    if (!n) return;
    onMade(store.put('business', asRec({ ...BLANK_BUSINESS, name: n, kind, system, owner })));
  };
  if (editKinds) return <KindsModal save={save} kinds={B.kinds} onClose={() => setEditKinds(false)} />;
  return (
    <Modal title="New business" onClose={onClose} dirty={!!name.trim()} className="pinned"
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!name.trim()} onClick={make}>Add business</button></>}>
      <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); make(); }}>
        <Field label="Name">{(id) => <TextInput id={id} value={name} maxLength={80} placeholder="Black Tea" onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Kind" hint={<button type="button" className="link-btn" onClick={() => setEditKinds(true)}>Edit kinds</button>}>{(id) => (
          <Dropdown id={id} value={kind} onChange={(v) => { setKind(v); setSystem(guessSystem(v)); }} options={B.kinds.map((k) => ({ id: k, label: k }))} />
        )}</Field>
        <Field label="How the game runs it">{(id) => <Dropdown id={id} value={system} onChange={(v) => setSystem(v as System)} options={SYSTEMS.map((s) => ({ id: s.id, label: s.label }))} />}</Field>
        <Field label="Owner household">{(id) => (
          <Dropdown id={id} value={owner} none="None yet" onChange={setOwner} options={B.ctx.hh.list.map((h) => ({ id: h.id, label: B.ctx.hh.nameOf(h.id) }))} />
        )}</Field>
      </form>
    </Modal>
  );
}

/** The editable list of business kinds, kept on the save. */
function KindsModal({ save, kinds, onClose }: { save: SaveRow; kinds: string[]; onClose(): void }) {
  const store = useStore();
  const [list, setList] = useState(kinds);
  const [name, setName] = useState('');
  const add = () => { const n = name.trim(); if (n && !list.some((k) => k.toLowerCase() === n.toLowerCase())) setList([...list, n]); setName(''); };
  return (
    <Modal title="Kinds of business" onClose={onClose} dirty={JSON.stringify(list) !== JSON.stringify(kinds)} className="pinned"
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!list.length} onClick={() => { store.updateSave(save.id, { bizKinds: list }); onClose(); }}>Save kinds</button></>}>
      <div className="stack" style={{ gap: 10 }}>
        {list.map((k) => (
          <div key={k} className="bz-kind"><span className="grow">{k}</span><button type="button" className="btn ghost icon sm" aria-label={`Remove ${k}`} onClick={() => setList(list.filter((x) => x !== k))}><X size={16} weight="bold" /></button></div>
        ))}
        <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
          <TextInput value={name} placeholder="New kind" aria-label="New kind" onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn" disabled={!name.trim()}>Add</button>
        </form>
      </div>
    </Modal>
  );
}

// ---------- one business ----------
function BusinessOne({ save, id }: { save: SaveRow; id: string }) {
  const B = useBiz(save);
  const store = useStore();
  const phone = useIsPhone();
  const [del, setDel] = useState(false);
  const [modal, setModal] = useState<null | 'staff' | 'rule' | 'activity' | 'reading' | 'start' | 'kinds'>(null);
  const [ruleId, setRuleId] = useState<CriterionId | null>(null);
  const row = B.rows.find((r) => r.id === id);
  if (!row) return <div className="page"><p>That business isn’t here anymore.</p><a className="btn" href={href(save)}>Back to Businesses</a></div>;
  const b = row.b;
  const put = (next: BusinessData) => store.put('business', asRec(next), id);
  const patch = (p: Partial<BusinessData>) => put({ ...b, ...p });
  const life = lifetimeOf(b);
  const sims = B.ctx.sims;
  const unusedRules = CRITERIA.filter((c) => !b.customers.some((r) => r.id === c.id));
  const kindOptions = b.kind && !B.kinds.includes(b.kind) ? [b.kind, ...B.kinds] : B.kinds;
  const extras = EXTRAS[b.system];
  return (
    <div className={phone ? 'm-stack' : 'page stack'} style={{ gap: 14 }}>
      <a className="ph-back" href={href(save)}><CaretLeft size={18} weight="bold" /> Businesses</a>
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start', minWidth: 0 }}><Icon size="lg" />
          <div style={{ minWidth: 0 }}><h1 style={{ overflowWrap: 'anywhere' }}>{b.name || 'Unnamed business'}</h1><div className="sub">{[b.kind, systemLabel(b.system)].filter(Boolean).join(' · ')}</div></div>
        </div>
        <button type="button" className="btn ghost icon" aria-label="Delete business" onClick={() => setDel(true)}><Trash size={20} /></button>
      </div>

      <div className="bz-grid">
        <div className="stack" style={{ gap: 14 }}>
          {/* Money */}
          <section className="card sl-card">
            <div className="card-head"><h2>Money</h2><button type="button" className="btn sm" onClick={() => setModal('reading')}><Plus size={14} weight="bold" /> Add a reading</button></div>
            <div className="bz-stats">
              <div><span className="lg-cap">Lifetime</span><b className="bz-big">{life !== null ? fmt(life) : '—'}</b></div>
              <div><span className="lg-cap">Last change</span><b className="bz-big">{lastChange(b) !== null ? signed(lastChange(b)!) : '—'}</b></div>
            </div>
            {showStartNote(b) && (
              <div className="notice warn" style={{ marginTop: 12 }}>
                <span>SimLogger only counts profit from when it’s installed. If this business already earned money, set its starting total.</span>
                <button type="button" className="btn sm" onClick={() => setModal('start')}>Set starting total</button>
              </div>
            )}
            {b.log.length > 0 ? (
              <div className="bz-log" role="table" aria-label="Money log">
                {[...b.log].reverse().map((r) => (
                  <div key={r.id} className="bz-lr" role="row">
                    <span className="muted small">{r.real ? new Date(r.real).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
                    <b>{fmt(r.total)}</b>
                    <span className={r.change === null ? 'muted small' : r.change >= 0 ? 'bz-up' : 'bz-down'}>{r.reset ? 'Reset in game' : r.change === null ? 'Starting point' : signed(r.change)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="muted small" style={{ margin: '12px 0 0' }}>No readings yet. SimLogger fills this in, or add a reading by hand.</p>}
            {b.start !== null && needsStartOk(b) && <button type="button" className="link-btn" style={{ marginTop: 8 }} onClick={() => setModal('start')}>Starting total {fmt(b.start)} · change</button>}
          </section>

          {/* Staff */}
          <section className="card sl-card">
            <div className="card-head"><h2>Staff{b.staff.length > 0 && <span className="cnt">{b.staff.length}</span>}</h2><button type="button" className="btn sm" onClick={() => setModal('staff')}><Plus size={14} weight="bold" /> {b.staff.length ? 'Change' : 'Add staff'}</button></div>
            {b.staff.length === 0 && <p className="muted small" style={{ margin: 0 }}>Pick from your Sims. Townies work here too.</p>}
            {b.staff.map((s) => {
              const sim = sims.get(s.sim);
              if (!sim) return null;
              return (
                <div key={s.sim} className="bz-staff">
                  <SimAvatar sim={sim} size={34} />
                  <a className="lg-gt grow" href={savePath(save.id, `sims/${s.sim}`)}><b>{B.ctx.nameOf(s.sim)}</b>{sim.townie && <small className="muted">Townie</small>}</a>
                  <input className="input bz-role" aria-label={`Role for ${sim.first}`} defaultValue={s.role} placeholder="Role" maxLength={40}
                    onBlur={(e) => { if (e.target.value !== s.role) patch({ staff: b.staff.map((x) => (x.sim === s.sim ? { ...x, role: e.target.value.trim() } : x)) }); }} />
                  <div className="bz-pay"><Dropdown ariaLabel={`Pay for ${sim.first}`} value={s.pay} onChange={(v) => patch({ staff: b.staff.map((x) => (x.sim === s.sim ? { ...x, pay: v as 'Low' | 'Medium' | 'High' } : x)) })} options={['Low', 'Medium', 'High'].map((x) => ({ id: x, label: x }))} /></div>
                </div>
              );
            })}
          </section>

          {/* Customers */}
          <section className="card sl-card">
            <div className="card-head"><h2>Customers</h2>{unusedRules.length > 0 && <button type="button" className="btn sm" onClick={() => setModal('rule')}><Plus size={14} weight="bold" /> Add</button>}</div>
            {b.customers.length === 0 && <p className="muted small" style={{ margin: 0 }}>Anyone can come in.</p>}
            {b.customers.map((r) => (
              <div key={r.id} className="bz-rule">
                <button type="button" className="bz-rule-main" onClick={() => setRuleId(r.id)}>
                  <b>{criterionOf(r.id).label}</b><span className="bz-rule-v">{r.values.length ? r.values.join(', ') : 'Pick'}</span>
                </button>
                <button type="button" className={`bz-lvl ${r.level}`} aria-label={`${criterionOf(r.id).label}: ${r.level}. Tap to switch`} onClick={() => put(setRule(b, r.id, { level: r.level === 'required' ? 'preferred' : 'required' }))}>{r.level === 'required' ? 'Required' : 'Preferred'}</button>
                <button type="button" className="btn ghost icon sm" aria-label={`Remove ${criterionOf(r.id).label}`} onClick={() => put(removeRule(b, r.id))}><X size={16} weight="bold" /></button>
              </div>
            ))}
          </section>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <section className="card sl-card">
            <div className="card-head"><h2>Details</h2></div>
            <div className="stack" style={{ gap: 14 }}>
              <Field label="Name">{(fid) => <TextInput id={fid} defaultValue={b.name} maxLength={80} onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== b.name) patch({ name: n }); else e.target.value = b.name; }} />}</Field>
              <Field label="Kind" hint={<button type="button" className="link-btn" onClick={() => setModal('kinds')}>Edit kinds</button>}>{(fid) => <Dropdown id={fid} value={b.kind} onChange={(v) => patch({ kind: v })} options={kindOptions.map((k) => ({ id: k, label: k }))} />}</Field>
              <Field label="How the game runs it">{(fid) => <Dropdown id={fid} value={b.system} onChange={(v) => patch({ system: v as System })} options={SYSTEMS.map((s) => ({ id: s.id, label: s.label }))} />}</Field>
              <Field label="Owner household">{(fid) => <Dropdown id={fid} value={b.owner} none="None yet" onChange={(v) => patch({ owner: v })} options={B.ctx.hh.list.map((h) => ({ id: h.id, label: B.ctx.hh.nameOf(h.id) }))} />}</Field>
              <div className="field"><span className="label">Rating</span><Stars n={b.rating} onChange={(v) => patch({ rating: v })} size={24} /></div>
              <Field label="Price level">{(fid) => <Dropdown id={fid} value={String(b.price)} onChange={(v) => patch({ price: Number(v) })} options={PRICES.map((p) => ({ id: String(p), label: priceText(p) }))} />}</Field>
            </div>
          </section>

          {b.system === 'small' && (
            <section className="card sl-card">
              <div className="card-head"><h2>Activities<span className="cnt">{b.activities.length}/{MAX_ACTIVITIES}</span></h2>{b.activities.length < MAX_ACTIVITIES && <button type="button" className="btn sm" onClick={() => setModal('activity')}><Plus size={14} weight="bold" /> Add</button>}</div>
              {b.activities.map((a) => (
                <div key={a} className="bz-kind"><span className="grow">{a}</span><button type="button" className="btn ghost icon sm" aria-label={`Remove ${a}`} onClick={() => patch({ activities: b.activities.filter((x) => x !== a) })}><X size={16} weight="bold" /></button></div>
              ))}
              {b.activities.length === 0 && <p className="muted small" style={{ margin: 0 }}>Up to five.</p>}
              <Field label="Entry fee">{(fid) => <Dropdown id={fid} value={b.fee} onChange={(v) => patch({ fee: v as Fee })} options={FEES.map((f) => ({ id: f, label: f }))} />}</Field>
            </section>
          )}

          {extras.length > 0 && (
            <section className="card sl-card">
              <div className="card-head"><h2>{systemLabel(b.system)}</h2></div>
              <div className="stack" style={{ gap: 14 }}>
                {extras.map((x) => (
                  <Field key={x.key} label={x.label}>{(fid) => <TextInput id={fid} defaultValue={b.extras[x.key] ?? ''} placeholder={x.placeholder} maxLength={120} onBlur={(e) => { if ((b.extras[x.key] ?? '') !== e.target.value.trim()) patch({ extras: { ...b.extras, [x.key]: e.target.value.trim() } }); }} />}</Field>
                ))}
              </div>
            </section>
          )}

          <section className="card sl-card">
            <div className="card-head"><h2>Notes</h2></div>
            <AutoText value={b.notes} onSave={(v) => patch({ notes: v })} placeholder="Anything about this business" label="Notes" rows={4} />
          </section>
        </div>
      </div>

      {modal === 'staff' && <StaffModal ctx={B.ctx} value={staffIds(b)} onClose={() => setModal(null)} onSave={(ids) => { put(setStaff(b, ids)); setModal(null); }} />}
      {modal === 'rule' && <PickRule unused={unusedRules.map((c) => c.id)} onClose={() => setModal(null)} onPick={(cid) => { setModal(null); setRuleId(cid); }} />}
      {ruleId && <RuleModal id={ruleId} rule={b.customers.find((r) => r.id === ruleId)} onClose={() => setRuleId(null)} onSave={(values, level) => { put(setRule(b, ruleId, { values, level })); setRuleId(null); }} />}
      {modal === 'activity' && <ActivityModal onClose={() => setModal(null)} onSave={(a) => { put(addActivity(b, a)); setModal(null); }} />}
      {modal === 'reading' && <MoneyModal title="Add a reading" label="Lifetime total now" hint={life !== null ? `Last total ${fmt(life)}.` : 'The first reading is the starting point.'} cta="Add reading" onClose={() => setModal(null)}
        onSave={(n) => { const next = addReading(b, n, saveData(save).today, nowIso()); put(next); toast(next === b ? 'No change since the last reading' : 'Reading added'); setModal(null); }} />}
      {modal === 'start' && <MoneyModal title="Starting total" label="Lifetime profit before SimLogger" hint="What this business had earned already. Nothing is counted from it." cta="Save" initial={b.start} onClose={() => setModal(null)}
        onSave={(n) => { put(setStart(b, n)); setModal(null); }} />}
      {modal === 'kinds' && <KindsModal save={save} kinds={B.kinds} onClose={() => setModal(null)} />}
      {del && (
        <Confirm title="Delete this business?" text="It goes to Trash for 7 days." onCancel={() => setDel(false)}
          actions={[{ label: 'Keep it', run: () => setDel(false) }, { label: 'Delete', kind: 'danger', run: () => { setDel(false); store.moveToTrash(id, b.name || 'Business'); go(href(save)); } }]} />
      )}
    </div>
  );
}
const needsStartOk = (b: BusinessData) => b.system === 'retail' || b.system === 'restaurant' || b.system === 'vet';

function StaffModal({ ctx, value, onClose, onSave }: { ctx: StoriesCtx; value: string[]; onClose(): void; onSave(ids: string[]): void }) {
  const [ids, setIds] = useState(value);
  return (
    <Modal title="Staff" onClose={onClose} dirty={JSON.stringify(ids) !== JSON.stringify(value)} className="pinned"
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" onClick={() => onSave(ids)}>{ids.length ? `Done · ${ids.length} selected` : 'Done'}</button></>}>
      <SimChecklist ctx={ctx} value={ids} onChange={setIds} />
    </Modal>
  );
}

function PickRule({ unused, onClose, onPick }: { unused: CriterionId[]; onClose(): void; onPick(id: CriterionId): void }) {
  return (
    <Modal title="Add a customer rule" onClose={onClose} autoFocus={false}>
      <div className="bz-pick">{unused.map((id) => <button key={id} type="button" className="bz-pick-b" onClick={() => onPick(id)}>{criterionOf(id).label}<CaretRight size={16} weight="bold" className="muted" /></button>)}</div>
    </Modal>
  );
}

function RuleModal({ id, rule, onClose, onSave }: { id: CriterionId; rule: Rule | undefined; onClose(): void; onSave(values: string[], level: 'required' | 'preferred'): void }) {
  const c = criterionOf(id);
  const [vals, setVals] = useState<string[]>(rule?.values ?? []);
  const [level, setLevel] = useState<'required' | 'preferred'>(rule?.level ?? 'required');
  const [text, setText] = useState('');
  const toggle = (v: string) => setVals((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v]));
  const addText = () => { const t = text.trim(); if (t && !vals.some((v) => v.toLowerCase() === t.toLowerCase())) setVals([...vals, t]); setText(''); };
  return (
    <Modal title={c.label} onClose={onClose} dirty className="pinned"
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!vals.length} onClick={() => onSave(vals, level)}>Done</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="seg" role="group" aria-label="How much it matters">
          {(['required', 'preferred'] as const).map((l) => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{l === 'required' ? 'Required' : 'Preferred'}</button>)}
        </div>
        {c.options ? (
          <div className="bz-checks">{c.options.map((o) => (
            <button key={o} type="button" role="checkbox" aria-checked={vals.includes(o)} className="ph-pk-sim" onClick={() => toggle(o)}><span className={`ph-cb ${vals.includes(o) ? 'on' : ''}`} aria-hidden="true" /><span className="ph-pk-t">{o}</span></button>
          ))}</div>
        ) : (
          <>
            <div className="bz-chips">{vals.map((v) => <button key={v} type="button" className="tag outline" onClick={() => toggle(v)}>{v} <X size={12} weight="bold" /></button>)}</div>
            <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); addText(); }}>
              <TextInput value={text} aria-label={`Add ${c.label.toLowerCase()}`} placeholder={id === 'traits' ? 'Foodie' : id === 'career' ? 'Chef' : 'Level 5 Cooking'} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
              <button type="submit" className="btn" disabled={!text.trim()}>Add</button>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}

function ActivityModal({ onClose, onSave }: { onClose(): void; onSave(a: string): void }) {
  const [t, setT] = useState('');
  return (
    <Modal title="New activity" onClose={onClose} dirty={!!t.trim()}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!t.trim()} onClick={() => onSave(t)}>Add activity</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (t.trim()) onSave(t); }}>
        <Field label="Activity">{(id) => <TextInput id={id} value={t} maxLength={40} placeholder="Yoga class" onChange={(e) => setT(e.target.value)} />}</Field>
      </form>
    </Modal>
  );
}

function MoneyModal({ title, label, hint, cta, initial, onClose, onSave }: { title: string; label: string; hint: string; cta: string; initial?: number | null; onClose(): void; onSave(n: number): void }) {
  const [t, setT] = useState(initial != null ? String(initial) : '');
  const n = Number(t.replace(/[,§\s]/g, ''));
  const ok = t.trim() !== '' && Number.isFinite(n) && n >= 0;
  return (
    <Modal title={title} onClose={onClose} dirty={!!t.trim()}
      footer={(close) => <><button type="button" className="btn" onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={!ok} onClick={() => onSave(n)}>{cta}</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (ok) onSave(n); }}>
        <Field label={label} hint={hint}>{(id) => <TextInput id={id} inputMode="numeric" value={t} placeholder="§0" onChange={(e) => setT(e.target.value)} />}</Field>
      </form>
    </Modal>
  );
}

