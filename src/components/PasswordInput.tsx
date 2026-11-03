import { useState } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';

/** Password box with a show/hide button. */
export function PasswordInput({
  id, value, onChange, autoComplete, invalid, describedBy,
}: {
  id: string;
  value: string;
  onChange(v: string): void;
  autoComplete: 'new-password' | 'current-password';
  invalid?: boolean;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input
        id={id}
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="pw-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        onClick={() => setShow(!show)}>
        {show ? <EyeSlash size={20} weight="duotone" /> : <Eye size={20} weight="duotone" />}
      </button>
    </div>
  );
}
