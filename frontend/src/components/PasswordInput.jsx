// A password box with a "Show / Hide" button, so people can check what they typed.
// The password is only shown on this screen when the person asks for it; it is never stored or sent anywhere else.

import { useState } from 'react';

export function PasswordInput({ value, onChange, autoComplete = 'current-password', autoFocus = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
