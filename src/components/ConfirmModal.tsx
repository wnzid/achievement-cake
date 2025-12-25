import React from 'react';
import Modal from './Modal';

export default function ConfirmModal({ open, title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', onCancel, onConfirm }: {
  open: boolean;
  title?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      actions={(
        <>
          {cancelLabel && cancelLabel.toString().trim() !== "" ? (
            <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.18)', padding: '8px 10px', borderRadius: 10 }}>{cancelLabel}</button>
          ) : null}
          <button onClick={onConfirm} style={{ background: '#ffffff', color: '#111', border: 'none', padding: '8px 12px', borderRadius: 10, fontWeight: 700 }}>{confirmLabel}</button>
        </>
      )}
    >
      <div style={{ color: 'white' }}>{message}</div>
    </Modal>
  );
}
