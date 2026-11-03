import { useMemo, useState } from 'react';
import { CalendarBlank, HouseSimple, Minus, Plus, User, UsersThree } from '@phosphor-icons/react';
import { Field, Modal, NoMatches, Picker, SearchBox, Sheet, TextInput, toast, type Option } from '../components/ui';
import { matches, plural } from '../lib/text';
import data from './demo-options.json';

/** Test area for step 2 on the style check page. Example content only; nothing here is saved. */

const OCCULTS: Option[] = data.occults.map((o) => ({ id: o.id, label: o.label }));
const ASPIRATIONS: Option[] = data.aspirations;
const BASE_TRAITS: Option[] = data.traits;
const EXAMPLE_NAMES = ['José Ramírez', 'Zoë Lindqvist', 'Renée Dubois', 'Chloé Okafor', 'Bella Goth', 'Mortimer Goth', 'Søren Berg', 'Ana María Núñez'];

function DemoForm({ onClose }: { onClose(): void }) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [occult, setOccult] = useState<string[]>([]);
  const [aspiration, setAspiration] = useState<string[]>([]);
  const [traits, setTraits] = useState<string[]>(['removed-example-trait']);
  const [extra, setExtra] = useState<Option[]>([]);
  const [second, setSecond] = useState(false);
  const traitOptions = useMemo(() => [...BASE_TRAITS, ...extra], [extra]);
  const dirty = first !== '' || last !== '' || occult.length > 0 || aspiration.length > 0 || traits.length !== 1 || traits[0] !== 'removed-example-trait';

  return (
    <Modal
      title="Example form"
      onClose={onClose}
      dirty={dirty}
      footer={
        <>
          <button type="button" className="btn" onClick={() => setSecond(true)}>Open a second pop-up</button>
          <button type="button" className="btn primary" onClick={() => { onClose(); toast('Saved (example only)'); }}>Save</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="First name">{(id) => <TextInput kind="name" id={id} value={first} onChange={(e) => setFirst(e.target.value)} />}</Field>
        <Field label="Last name">{(id) => <TextInput kind="name" id={id} value={last} onChange={(e) => setLast(e.target.value)} />}</Field>
        <Field label="Aspiration">{(id) => <Picker id={id} options={ASPIRATIONS} value={aspiration} onChange={setAspiration} placeholder="Search aspirations" />}</Field>
        <Field label="Occult">{(id) => <Picker id={id} options={OCCULTS} value={occult} onChange={setOccult} placeholder="Search occults" />}</Field>
        <Field label="Traits" full hint="The first tag shows how a deleted option looks.">
          {(id) => (
            <Picker id={id} multiple options={traitOptions} value={traits} onChange={setTraits} placeholder="Search traits, or type a new one"
              onAdd={(label) => { const o = { id: `new-${Date.now()}`, label, group: 'Added' }; setExtra((x) => [...x, o]); return o.id; }} />
          )}
        </Field>
      </div>
      {second && (
        <Modal title="Second pop-up" onClose={() => setSecond(false)}>
          <p style={{ margin: 0 }}>Press Escape or tap outside. Only this one should close, and the form behind keeps what you typed.</p>
        </Modal>
      )}
    </Modal>
  );
}

function DemoSheet({ onClose }: { onClose(): void }) {
  const rows = [
    { label: 'New Sim', icon: User, cat: 'sims' },
    { label: 'New household', icon: HouseSimple, cat: 'households' },
    { label: 'Add holiday', icon: CalendarBlank, cat: 'calendar' },
    { label: 'New club', icon: UsersThree, cat: 'clubs' },
  ] as const;
  return (
    <Sheet title="Example menu" onClose={onClose}>
      <div className="m-group">
        {rows.map(({ label, icon: I, cat }) => (
          <button key={label} type="button" className="m-row" onClick={() => { onClose(); toast(`${label} (example only)`); }}>
            <span className={`obj ${cat}`}><I size={16} weight="duotone" /></span>
            <span className="t">{label}</span>
          </button>
        ))}
      </div>
      <p className="m-help" style={{ marginTop: 12 }}>Swipe down, tap outside, or press Escape to close.</p>
    </Sheet>
  );
}

export function SharedDemo() {
  const [form, setForm] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState('');
  const [n, setN] = useState(1);
  const found = EXAMPLE_NAMES.filter((x) => matches(x, q));

  return (
    <section>
      <h2>Shared pieces</h2>
      <p className="sc-why">Try these out. Everything here is an example and nothing gets saved.</p>
      <div className="stack">
        <div className="card stack">
          <h3>Pop-up</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Type a full name and make sure the cursor never jumps. Pick an aspiration and an occult side by side. Then tap outside or
            press × with something typed, and you’ll get the “Discard changes?” message.
          </p>
          <div><button type="button" className="btn primary" onClick={() => setForm(true)}>Open the example form</button></div>
        </div>

        <div className="card stack">
          <h3>Sheet</h3>
          <div><button type="button" className="btn primary" onClick={() => setSheet(true)}>Open the example menu</button></div>
        </div>

        <div className="card stack">
          <h3>Message with a button</h3>
          <div>
            <button type="button" className="btn" onClick={() => toast('Example item deleted', { label: 'Undo', run: () => toast('Brought it back') })}>
              Show a message with Undo
            </button>
          </div>
        </div>

        <div className="card stack">
          <h3>Search</h3>
          <p className="small muted" style={{ margin: 0 }}>Try “jose”, “ZOE”, “ren” or “goth bel”.</p>
          <SearchBox value={q} onChange={setQ} placeholder={`Search ${plural(EXAMPLE_NAMES.length, 'example Sim')}`} />
          {found.length ? (
            <div className="tags">{found.map((x) => <span key={x} className="tag sims">{x}</span>)}</div>
          ) : (
            <NoMatches query={q} />
          )}
        </div>

        <div className="card stack">
          <h3>Plurals</h3>
          <div className="row">
            <button type="button" className="btn icon sm" aria-label="One less" onClick={() => setN((x) => Math.max(0, x - 1))}><Minus size={14} weight="bold" /></button>
            <button type="button" className="btn icon sm" aria-label="One more" onClick={() => setN((x) => x + 1)}><Plus size={14} weight="bold" /></button>
            <span>{plural(n, 'household')} · {plural(n, 'home')} · {plural(n, 'holiday')} · {plural(n, 'life stage')}</span>
          </div>
        </div>
      </div>
      {form && <DemoForm onClose={() => setForm(false)} />}
      {sheet && <DemoSheet onClose={() => setSheet(false)} />}
    </section>
  );
}
