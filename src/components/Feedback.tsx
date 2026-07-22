import { useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export type DialogState = {
  title: string;
  message: string;
  input?: string;
  codeLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | boolean | null) => void;
};

function CodeInput({ length, value, onChange }: { length: number; value: string; onChange: (value: string) => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const characters = Array.from({ length }, (_, index) => value[index] || "");
  const clean = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, length);
  const replaceAt = (index: number, character: string) => {
    const next = [...characters];
    next[index] = character;
    onChange(next.join(""));
  };
  return <div className="codeinputs" onPaste={(event) => {
    const pasted = clean(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, length) - 1]?.focus();
  }}>
    {characters.map((character, index) => <input
      key={index}
      ref={(element) => { refs.current[index] = element; }}
      autoFocus={index === 0}
      aria-label={`Camp code character ${index + 1} of ${length}`}
      autoCapitalize="characters"
      autoComplete={index === 0 ? "one-time-code" : "off"}
      inputMode="text"
      maxLength={1}
      value={character}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const next = clean(event.target.value).slice(-1);
        replaceAt(index, next);
        if (next && index < length - 1) refs.current[index + 1]?.focus();
      }}
      onKeyDown={(event) => {
        if (event.key === "Backspace" && !character && index > 0) {
          event.preventDefault();
          replaceAt(index - 1, "");
          refs.current[index - 1]?.focus();
        }
        if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
        if (event.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
      }}
    />)}
  </div>;
}

export function AppDialog({ dialog, close }: { dialog: DialogState; close: (value: string | boolean | null) => void }) {
  const [value, setValue] = useState(dialog.input || "");
  const hasInput = dialog.input !== undefined;
  const complete = !dialog.codeLength || value.length === dialog.codeLength;
  return <div className="backdrop dialogbackdrop" onMouseDown={() => close(hasInput ? null : false)}><form className="modal alertmodal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (complete) close(hasInput ? value : true); }}>
    <button type="button" className="close" onClick={() => close(hasInput ? null : false)}><X /></button>
    <span className="alerticon"><AlertTriangle /></span>
    <h2>{dialog.title}</h2>
    <p className="dialogmessage">{dialog.message}</p>
    {hasInput && (dialog.codeLength ? <CodeInput length={dialog.codeLength} value={value} onChange={setValue} /> : <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} />)}
    <div className="dialogactions"><button type="button" className="secondary" onClick={() => close(hasInput ? null : false)}>{dialog.cancelLabel || "Cancel"}</button><button className="primary" disabled={!complete}>{dialog.confirmLabel || "Confirm"}</button></div>
  </form></div>;
}

export function NoticePopup({ message, close }: { message: string; close: () => void }) {
  return <div className="backdrop dialogbackdrop" onMouseDown={close}><div className="modal alertmodal" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="close" onClick={close}><X /></button><span className="alerticon"><AlertTriangle /></span><h2>Something needs attention</h2><p className="dialogmessage">{message}</p><button className="primary" onClick={close}>Got it</button></div></div>;
}
