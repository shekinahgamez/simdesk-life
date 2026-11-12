import { useMemo, useRef, useState } from 'react';
import {
  ArrowsClockwise, Briefcase, CalendarBlank, CaretDown, CheckCircle, Check, Clock, Coins, FileArrowUp, Sparkle,
  Star, Storefront, UserPlus, UsersThree, Warning,
} from '@phosphor-icons/react';
import { Modal, toast } from '../components/ui';
import { applyBusiness, planBusinesses, type BizPlan } from '../lib/bizImport';
import { businessData, businessRows } from '../lib/businesses';
import { applyMoney, parseLog, planImport, type Change, type GameLog, type MoneyRow, type Plan, type SimPlan } from '../lib/gameLog';
import { totals, bySim, fmt, logToday, moneyData, moneyId, moneySettings } from '../lib/money';
import { cleanRotation, playNow } from '../lib/rotation';
import { moduleOn, saveData, tableOf } from '../lib/saves';
import { householdData } from '../lib/households';
import { lotData } from '../lib/lots';
import { simData, type SimData } from '../lib/sims';
import { newId } from '../lib/sync/store';
import { useRecords, useStore } from '../lib/sync/react';
import type { Rec, SaveRow } from '../lib/sync/types';
import { plural } from '../lib/text';

const KIND_ICON = { stage: Clock, traits: Sparkle, career: Briefcase, aspiration: Star, gender: UsersThree, link: UserPlus } as const;
const KIND_WORD: Record<Change['kind'], string> = { stage: 'Life stage', traits: 'Traits', career: 'Career', aspiration: 'Aspiration', gender: 'Gender', link: 'New Sim' };

/** The Import from game button (desktop only: the game is played on a computer) and its review sheet. */
export function ImportFromGame({ save, className = 'btn' }: { save: SaveRow; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}><FileArrowUp size={16} weight="bold" /> Import from game</button>
      {open && <ImportDialog save={save} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportDialog({ save, onClose }: { save: SaveRow; onClose(): void }) {
  const [log, setLog] = useState<GameLog | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File | undefined) => {
    if (!f) return;
    const r = parseLog(await f.text());
    if ('error' in r) { setError(r.error); return; }
    setError(''); setFileName(f.name); setLog(r.log);
  };
  if (!log) {
    return (
      <Modal title="Import from game" onClose={onClose} autoFocus={false} footer={<button type="button" className="btn" onClick={onClose}>Cancel</button>}>
        <div className="gi-pick">
          <button type="button" className="gi-drop" onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void read(e.dataTransfer.files[0]); }}>
            <FileArrowUp size={32} weight="duotone" />
            <b>Pick the file SimLogger saved</b>
            <span className="muted">or drop it here</span>
          </button>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => void read(e.target.files?.[0])} />
          <div className="gi-hint"><CheckCircle size={18} weight="fill" /><span>In the game, type <code>simdesk.log</code> in the cheat box. The file lands in Documents › Electronic Arts › The Sims 4 › SimDesk.</span></div>
          {error && <div className="gi-note warn" role="alert"><Warning size={18} weight="fill" /><span>{error}</span></div>}
        </div>
      </Modal>
    );
  }
  return <Review save={save} log={log} fileName={fileName} onPickAnother={() => setLog(null)} onClose={onClose} />;
}

function Review({ save, log, fileName, onPickAnother, onClose }: { save: SaveRow; log: GameLog; fileName: string; onPickAnother(): void; onClose(): void }) {
  const store = useStore();
  const d = saveData(save);
  const simRecs = useRecords('sim');
  const hhRecs = useRecords('household');
  const lots = useRecords('lot');
  const moneyRecs = useRecords('money');
  const bizRecs = useRecords('business');
  const bizOn = moduleOn(d, 'venues');
  const fundsOn = moduleOn(d, 'funds');
  const rotOn = moduleOn(d, 'rotation');
  const set = moneySettings(d.money);

  const plan = useMemo<Plan>(() => {
    const hh = hhRecs.map((r) => ({ id: r.id, name: householdData(r).name, gameId: householdData(r).gameId }));
    const matched = hh.find((h) => h.gameId === log.household.id) ?? hh.find((h) => h.name.toLowerCase().includes(log.household.name.toLowerCase()) && log.household.name);
    const money = fundsOn && matched ? { data: moneyData(moneyRecs.find((r) => r.id === moneyId(matched.id)), matched.id), snb: set.snb } : null;
    const rot = rotOn ? cleanRotation(d.rotation, (id) => hhRecs.some((r) => r.id === id)) : null;
    return planImport(log, {
      sims: simRecs.map((r) => ({ id: r.id, data: simData(r) as SimData })), households: hh,
      today: d.today, calendar: d.calendar, trackDate: d.trackDate, table: tableOf(d),
      rotation: rot, link: d.gameLink ?? null, money: money ?? (fundsOn ? { data: moneyData(undefined, ''), snb: set.snb } : null), newId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);

  const bizPlans = useMemo<BizPlan[]>(() => (bizOn ? planBusinesses(log.businesses, businessRows(bizRecs),
    simRecs.map((r) => ({ id: r.id, gameId: simData(r).gameId, name: `${simData(r).first} ${simData(r).last}`.trim() })), d.bizKinds, fmt) : []).filter((p) => p.changes.length || p.needsStart),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [log]);
  const [starts, setStarts] = useState<Record<string, string>>({});
  const bizIds = bizPlans.flatMap((p) => p.changes.map((c) => c.id));
  const allIds = useMemo(() => [
    ...plan.sims.flatMap((s) => s.changes.map((c) => c.id)), ...plan.money.map((m) => m.id),
    ...(plan.date ? [plan.date.id] : []), ...(plan.turn ? [plan.turn.id] : []), ...bizIds,
  ], [plan, bizIds.join()]);
  const defaults = useMemo(() => new Set([
    ...plan.sims.flatMap((s) => s.changes.filter((c) => c.on).map((c) => c.id)), ...plan.money.map((m) => m.id),
    ...(plan.date ? [plan.date.id] : []), ...(plan.turn ? [plan.turn.id] : []), ...bizIds,
  ]), [plan, bizIds.join()]);
  const [picked, setPicked] = useState<Set<string>>(defaults);
  const withChanges = plan.sims.filter((s) => s.changes.length);
  const [openSims, setOpenSims] = useState<Set<string>>(new Set(withChanges[0] ? [withChanges[0].key] : []));
  const flip = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const flipSim = (s: SimPlan) => setPicked((p) => {
    const n = new Set(p); const all = s.changes.every((c) => n.has(c.id));
    s.changes.forEach((c) => (all ? n.delete(c.id) : n.add(c.id))); return n;
  });
  const flipOpen = (k: string) => setOpenSims((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const allOpen = withChanges.every((s) => openSims.has(s.key));
  const count = allIds.filter((id) => picked.has(id)).length;

  const apply = () => {
    const before: { id: string; kind: string; data: Record<string, unknown> | null }[] = [];
    const rec = (id: string): Rec | undefined => store.get(id);
    const write = (kind: string, id: string, data: Record<string, unknown>) => {
      const old = rec(id);
      before.push({ id, kind, data: old ? old.data : null });
      store.put(kind, data, id);
    };
    const saveBefore = { today: d.today, rotation: d.rotation, gameLink: d.gameLink };
    // household (always linked)
    const hOld = hhRecs.find((r) => r.id === plan.householdId);
    write('household', plan.householdId, { ...(hOld?.data ?? { name: plan.householdName, home: null, notes: '' }), gameId: log.household.id });
    // Sims
    const memberIds: string[] = [];
    for (const s of plan.sims) {
      const ticked = s.changes.filter((c) => picked.has(c.id));
      if (s.isNew) {
        if (!ticked.length) continue;
        write('sim', s.simId, { ...s.create! } as unknown as Record<string, unknown>);
        memberIds.push(s.simId);
        continue;
      }
      const cur = simRecs.find((r) => r.id === s.simId)!;
      const patch = Object.assign({}, ...ticked.map((c) => c.patch), { gameId: s.gameId });
      write('sim', s.simId, { ...cur.data, ...patch });
    }
    // date + link
    const savePatch: Record<string, unknown> = {};
    let today = d.today;
    if (plan.date && picked.has(plan.date.id)) { today = plan.date.now; savePatch.today = today; }
    if (log.gameDay !== null && d.trackDate && (!d.gameLink || (plan.date && picked.has(plan.date.id)))) savePatch.gameLink = { game: log.gameDay, desk: today };
    if (plan.turn && picked.has(plan.turn.id) && rotOn) {
      savePatch.rotation = playNow(cleanRotation(d.rotation, (id) => hhRecs.some((r) => r.id === id)), plan.householdId, today);
    }
    if (Object.keys(savePatch).length) store.updateSave(save.id, savePatch);
    // money
    const rows = plan.money.filter((m) => picked.has(m.id));
    if (rows.length && fundsOn) {
      const mid = moneyId(plan.householdId);
      const cur = moneyData(store.get(mid), plan.householdId);
      const next = applyMoney(cur, rows);
      const members = [...new Set([...simRecs.filter((r) => simData(r).householdId === plan.householdId && !simData(r).deceased).map((r) => r.id), ...memberIds])];
      const lotsValue = lots.map((r) => ({ id: r.id, lot: lotData(r) })).filter((r) => r.lot.owner === plan.householdId && !r.id.startsWith('apt:')).reduce((a, r) => a + (r.lot.price ?? 0), 0);
      const nt = totals(next, set, lotsValue);
      write('money', mid, { ...next, household: plan.householdId, log: logToday(next, today, nt.net, bySim(next, set, members, lotsValue)) } as unknown as Record<string, unknown>);
    }
    // businesses
    for (const bp of bizPlans) {
      if (!bp.changes.some((c) => picked.has(c.id))) continue;
      const bid = bp.existing ?? newId();
      const cur = bp.existing ? businessData(store.get(bp.existing)) : null;
      const st = starts[bp.key]?.replace(/[,§\s]/g, '');
      const startNum = st && Number.isFinite(Number(st)) && Number(st) >= 0 ? Number(st) : null;
      write('business', bid, applyBusiness(bp, cur, picked, startNum, today, new Date().toISOString()) as unknown as Record<string, unknown>);
    }
    onClose();
    toast(`${plan.householdName} updated · ${plural(count, 'change')}`, {
      label: 'Undo',
      run: () => {
        store.updateSave(save.id, saveBefore);
        const made = before.filter((b) => !b.data).map((b) => b.id);
        for (const b of before.slice().reverse()) if (b.data) store.put(b.kind, b.data, b.id);
        if (made.length) store.moveManyToTrash(made, 'Imported', true);
      },
    });
  };

  return (
    <Modal title="Import from game" onClose={onClose} className="pinned gi-modal" autoFocus={false}
      footer={
        <>
          <span className="gi-sum">{plural(count, 'change')} picked</span>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={!count && !plan.sims.length} onClick={apply}>{count ? `Add ${plural(count, 'change')}` : 'Link only'}</button>
        </>
      }>
      <div className="gi-wrap">
        <div className="gi-file">
          <span className="gi-ic"><FileArrowUp size={20} weight="duotone" /></span>
          <div><b>{plan.householdName}{plan.householdIsNew ? ' (new household)' : ''}</b><small>{fileName} · {plural(log.household.sims.length, 'Sim')}</small></div>
          <button type="button" className="btn sm ghost" onClick={onPickAnother}>Pick another file</button>
        </div>
        <div className="gi-cols">
          <div className="gi-wrap">
            {plan.date && <Section icon={<CalendarBlank size={16} weight="bold" />} title="Game date"><Row on={picked.has('date')} onFlip={() => flip('date')}>Move SimDesk to: <span className="gi-was">{plan.date.text.split(' → ')[0]}</span> <b>{plan.date.text.split(' → ')[1]}</b></Row></Section>}
            {plan.turn && <Section icon={<ArrowsClockwise size={16} weight="bold" />} title="Rotation"><Row on={picked.has('turn')} onFlip={() => flip('turn')}>{plan.turn.text}</Row></Section>}
            {plan.money.length > 0 && (
              <Section icon={<Coins size={16} weight="bold" />} title="Money">
                {plan.money.map((m) => <Row key={m.id} on={picked.has(m.id)} onFlip={() => flip(m.id)} sub={m.sub} tag={m.kind === 'funds' && m.was !== null ? `${m.now >= m.was ? '+' : '−'}${fmt(Math.abs(m.now - m.was))}` : ''}><MoneyText m={m} /></Row>)}
              </Section>
            )}
            {bizPlans.length > 0 && (
              <Section icon={<Storefront size={16} weight="bold" />} title={`Businesses · ${bizPlans.length}`}>
                {bizPlans.map((bp) => (
                  <div key={bp.key} className="gi-biz">
                    <div className="gi-row"><div className="gi-what"><b>{bp.log.name}</b><small>{bp.existing ? 'In SimDesk' : 'New business'}</small></div></div>
                    {bp.changes.filter((c) => c.kind !== 'new').map((c) => <Row key={c.id} on={picked.has(c.id)} onFlip={() => flip(c.id)}>{c.text}: {c.was && <span className="gi-was">{c.was}</span>} <b>{c.now}</b></Row>)}
                    {bp.changes.some((c) => c.kind === 'new') && !bp.changes.some((c) => c.kind !== 'new') && <Row on={picked.has(`${bp.key}:new`)} onFlip={() => flip(`${bp.key}:new`)}>Add {bp.log.name}</Row>}
                    {bp.needsStart && (
                      <label className="gi-start"><span>Starting total</span>
                        <input className="input" inputMode="numeric" placeholder="§0" value={starts[bp.key] ?? ''} onChange={(e) => setStarts({ ...starts, [bp.key]: e.target.value })} aria-label={`Starting total for ${bp.log.name}`} />
                        <small className="muted">SimLogger only counts profit from when it’s installed. If this business already earned money, enter what it had.</small></label>
                    )}
                    {bp.unmatchedStaff > 0 && <small className="muted gi-biz-n">{plural(bp.unmatchedStaff, 'worker')} not in SimDesk yet.</small>}
                  </div>
                ))}
              </Section>
            )}
            {plan.linkNote && <div className="gi-note"><CheckCircle size={18} weight="fill" /><span>{plan.linkNote}</span></div>}
            {plan.skipped.length > 0 && <div className="gi-note warn"><Warning size={18} weight="fill" /><span>Not read: {plan.skipped.join(', ')}. Those amounts stay as they were.</span></div>}
          </div>
          <div className="gi-wrap">
            <Section icon={<UsersThree size={16} weight="bold" />} title={`Sims · ${withChanges.length} changed`} action={withChanges.length > 1 ? <button type="button" className="gi-link" onClick={() => setOpenSims(allOpen ? new Set() : new Set(withChanges.map((s) => s.key)))}>{allOpen ? 'Close all' : 'Open all'}</button> : null}>
              {withChanges.map((s) => <SimRow key={s.key} s={s} picked={picked} open={openSims.has(s.key)} onFlipSim={() => flipSim(s)} onFlip={flip} onOpen={() => flipOpen(s.key)} />)}
              {plan.quiet.length > 0 && <div className="gi-quiet"><CheckCircle size={18} /> No changes for {plan.quiet.join(', ')}</div>}
              {!withChanges.length && !plan.quiet.length && <div className="gi-quiet">No Sims in this file.</div>}
            </Section>
            {plan.notes.map((n) => <div key={n} className="gi-note"><CheckCircle size={18} weight="fill" /><span>{n}</span></div>)}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function MoneyText({ m }: { m: MoneyRow }) {
  return <>{m.label}: {m.was !== null && <span className="gi-was">{fmt(m.was)}</span>} <b>{fmt(m.now)}</b></>;
}

function Section({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="gi-sec"><h3>{icon}{title}{action}</h3><div className="gi-list">{children}</div></section>;
}

function Box({ on, some, onFlip, label }: { on: boolean; some?: boolean; onFlip(): void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={some ? 'mixed' : on} aria-label={label} className={`gi-ck${on ? ' on' : ''}${some ? ' some' : ''}`} onClick={(e) => { e.stopPropagation(); onFlip(); }}>
      {on && <Check size={14} weight="bold" />}{some && <span className="gi-dash" />}
    </button>
  );
}

function Row({ on, onFlip, children, sub, tag }: { on: boolean; onFlip(): void; children: React.ReactNode; sub?: string; tag?: string }) {
  return (
    <div className="gi-row">
      <Box on={on} onFlip={onFlip} label="Include this change" />
      <div className="gi-what">{children}{sub && <small>{sub}</small>}</div>
      {tag && <span className="gi-tag">{tag}</span>}
    </div>
  );
}

function SimRow({ s, picked, open, onFlipSim, onFlip, onOpen }: { s: SimPlan; picked: Set<string>; open: boolean; onFlipSim(): void; onFlip(id: string): void; onOpen(): void }) {
  const n = s.changes.filter((c) => picked.has(c.id)).length;
  const kinds = [...new Set(s.changes.map((c) => c.kind))];
  return (
    <>
      <div className={`gi-sim${open ? ' open' : ''}${s.isNew ? ' fresh' : ''}`}>
        <Box on={n === s.changes.length} some={n > 0 && n < s.changes.length} onFlip={onFlipSim} label={`Include everything for ${s.name}`} />
        <button type="button" className="gi-simbtn" aria-expanded={open} onClick={onOpen}>
          <span className="gi-av">{s.isNew ? <UserPlus size={16} weight="bold" /> : s.initials}</span>
          <span className="gi-nm">{s.isNew ? `${s.name} (new)` : s.name}</span>
          <span className="gi-kinds">
            {s.isNew ? <span className="gi-k">{s.changes[0].now}</span> : kinds.slice(0, 2).map((k) => { const I = KIND_ICON[k]; return <span key={k} className="gi-k"><I size={14} weight="bold" />{KIND_WORD[k]}</span>; })}
            {!s.isNew && kinds.length > 2 && <span className="gi-k">+{kinds.length - 2}</span>}
          </span>
          <CaretDown size={16} weight="bold" className="gi-car" />
        </button>
      </div>
      {open && !s.isNew && (
        <div className="gi-det">
          {s.changes.map((c) => (
            <Row key={c.id} on={picked.has(c.id)} onFlip={() => onFlip(c.id)} sub={c.note}>
              {c.label}: {c.was && <span className="gi-was">{c.was}</span>} <b>{c.now}</b>
            </Row>
          ))}
        </div>
      )}
      {open && s.isNew && <div className="gi-det"><div className="gi-row"><div className="gi-what muted">Added with everything the game knows: traits, career and life stage.</div></div></div>}
    </>
  );
}
