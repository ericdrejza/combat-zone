import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'onKeyDown'> & {
  committedValue: string;
  onCommit: (value: string) => void;
  onPreview?: (value: string | null) => void;
};

/** Typing may preview visually; Escape restores the committed name and blur/Enter commits. */
export function PropertiesNameInput({ committedValue, onCommit, onPreview, ...props }: Props) {
  const [draft, setDraft] = useState(committedValue);
  const preview = useRef(onPreview); preview.current = onPreview;
  useEffect(() => { setDraft(committedValue); preview.current?.(null); }, [committedValue]);
  return <input {...props} type="text" value={draft} onChange={event => { setDraft(event.currentTarget.value); onPreview?.(event.currentTarget.value); }}
    onBlur={() => { const name = draft.trim(); if (!props.disabled && !props.readOnly && name !== committedValue) onCommit(name); onPreview?.(null); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(committedValue); onPreview?.(null); }
      else if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
    }} />;
}
