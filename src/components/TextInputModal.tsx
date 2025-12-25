import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';

export default function TextInputModal({
  open,
  title,
  initialValue = '',
  placeholder,
  onCancel,
  onSubmit
}: {
  open: boolean;
  title?: string;
  initialValue?: string;
  placeholder?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => setValue(initialValue), [initialValue]);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      actions={(
        <>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.18)', padding: '8px 10px', borderRadius: 10 }}>Cancel</button>
          <button onClick={() => onSubmit(value.trim())} style={{ background: '#ffffff', color: '#111', border: 'none', padding: '8px 12px', borderRadius: 10, fontWeight: 700 }}>Done</button>
        </>
      )}
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'white', outline: 'none' }}
      />
    </Modal>
  );
}
