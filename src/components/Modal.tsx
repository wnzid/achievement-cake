import React, { useEffect } from 'react';

export default function Modal({ open, title, children, onClose, actions }: {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  actions?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
      <div role="dialog" aria-modal="true" style={{ width: 520, maxWidth: 'calc(100% - 32px)', background: '#151525', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 16, color: 'white', fontFamily: 'system-ui', boxSizing: 'border-box', overflow: 'hidden' }}>
        {title && <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>}
        <div>{children}</div>
        {actions && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>{actions}</div>}
      </div>
    </div>
  );
}
