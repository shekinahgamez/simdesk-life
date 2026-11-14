import { useEffect, useRef } from 'react';
import { KIT } from '../../config/landing';

type Kind = keyof typeof KIT;

function say(form: HTMLFormElement, text: string, kind: 'err' | 'ok') {
  let el = form.querySelector<HTMLElement>('.lp-status');
  if (!el) {
    el = document.createElement('div');
    el.className = 'lp-status';
    el.setAttribute('role', 'status');
    form.appendChild(el);
  }
  el.className = `lp-status ${kind}`;
  el.textContent = text;
}

/** Chips are multi-select; picking "Other" in the play group opens its type-in box. */
function toggleChip(chip: HTMLElement) {
  const on = chip.getAttribute('aria-checked') !== 'true';
  chip.setAttribute('aria-checked', String(on));
  const form = chip.closest('form');
  if (!form) return;
  if (chip.dataset.field === 'fields[how_you_play]' && chip.dataset.value === 'Other') {
    const box = form.querySelector<HTMLInputElement>('[data-other]');
    if (box) { box.hidden = !on; if (on) box.focus(); else box.value = ''; }
  }
}

/** Builds what Kit expects: email_address, first_name and fields[...]; chips join into one comma list. */
function collect(form: HTMLFormElement): FormData {
  const data = new FormData(form);
  const groups = new Map<string, string[]>();
  form.querySelectorAll<HTMLElement>('[role=checkbox][data-field]').forEach((c) => {
    if (c.getAttribute('aria-checked') === 'true') {
      const k = c.dataset.field!;
      groups.set(k, [...(groups.get(k) ?? []), c.dataset.value!]);
    }
  });
  groups.forEach((v, k) => data.set(k, v.join(', ')));
  return data;
}

async function submit(form: HTMLFormElement, kind: Kind) {
  const email = form.querySelector<HTMLInputElement>('input[type=email]');
  if (!email || !email.value.trim() || !email.checkValidity()) { say(form, 'Add your email so I can reach you.', 'err'); email?.focus(); return; }
  if (kind === 'beta') {
    const missing = form.querySelector<HTMLElement>('[name=first_name]:invalid, [name="fields[sims_tracked]"]:invalid, [name="fields[quit_last_tracker]"]:invalid, [name="fields[save_description]"]:invalid');
    if (missing) { say(form, 'Fill in the highlighted questions first.', 'err'); (missing as HTMLInputElement).focus(); return; }
  }
  const url = KIT[kind];
  if (!url) { say(form, 'Sign-ups are not open yet. Check back soon.', 'err'); return; }
  const btn = form.querySelector<HTMLButtonElement>('button[type=submit]');
  if (btn) btn.disabled = true;
  try {
    // Kit's form endpoint does not allow reading the reply from another site, so a sent request counts as done.
    await fetch(url, { method: 'POST', mode: 'no-cors', body: collect(form) });
    const done = document.createElement('div');
    done.className = 'lp-done';
    done.setAttribute('role', 'status');
    done.innerHTML = kind === 'beta'
      ? '<h3>Application sent.</h3><p>Thank you. Check your email for what happens next.</p>'
      : '<h3>You are on the list.</h3><p>One email when beta applications open.</p>';
    form.replaceChildren(done);
  } catch {
    say(form, 'That did not go through. Check your connection and try again.', 'err');
    if (btn) btn.disabled = false;
  }
}

/** Pricing page: Annual or Monthly price on the Obsessed card. */
function setPlan(root: HTMLElement, annual: boolean) {
  const set = (id: string, text: string) => { const el = root.querySelector(id); if (el) el.textContent = text; };
  set('#amt', annual ? '$8' : '$10');
  set('#bill', annual ? 'Billed $96 once a year. Save 20%.' : 'Billed monthly. Cancel any time.');
  root.querySelectorAll<HTMLElement>('[data-plan]').forEach((b) => {
    const on = (b.dataset.plan === 'a') === annual;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

/** Pricing page: opens and closes the comparison table. */
function toggleCompare(root: HTMLElement) {
  const box = root.querySelector<HTMLElement>('#cmpBox');
  const btn = root.querySelector<HTMLElement>('[data-cmp]');
  const label = root.querySelector<HTMLElement>('#cmpLbl');
  const car = root.querySelector<HTMLElement>('#cmpCar');
  if (!box || !btn) return;
  const open = box.style.display === 'none';
  box.style.display = open ? 'block' : 'none';
  btn.setAttribute('aria-expanded', String(open));
  if (label) label.textContent = open ? 'Hide the comparison ' : 'Compare all features ';
  if (car) car.innerHTML = open ? '&#9652;' : '&#9662;';
}

/** Wires up a page whose markup lives in a plain HTML file: scroll links, chips and the Kit forms. */
export function usePageBehavior() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const scroll = t.closest<HTMLElement>('[data-scroll]');
      if (scroll) {
        e.preventDefault();
        document.getElementById(scroll.dataset.scroll!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const chip = t.closest<HTMLElement>('[role=checkbox][data-field]');
      if (chip) { toggleChip(chip); return; }
      const plan = t.closest<HTMLElement>('[data-plan]');
      if (plan) { setPlan(root, plan.dataset.plan === 'a'); return; }
      if (t.closest('[data-cmp]')) toggleCompare(root);
    };
    const onKey = (e: KeyboardEvent) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[role=checkbox][data-field]');
      if (chip && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); toggleChip(chip); }
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      const kind = form.dataset.kit as Kind | undefined;
      if (!kind) return;
      e.preventDefault();
      void submit(form, kind);
    };
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    root.addEventListener('submit', onSubmit);
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('submit', onSubmit);
    };
  }, []);
  return ref;
}
