import Modal from "./Modal";
import type { Theme } from "../themes";

export default function HowToModal({ open, onClose, theme }: { open: boolean; onClose: () => void; theme: Theme }) {
  return (
    <Modal open={open} title="How to use" onClose={onClose} actions={<button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#fff', color: '#111', fontWeight: 700 }}>Close</button>}>
      <div style={{ fontSize: 14, opacity: 0.95, lineHeight: 1.65, color: theme.ui.textPrimary }}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={{ marginBottom: 10, fontSize: 14 }}><strong>Start</strong> with the Default <strong>chocolate</strong> cake.</li>
          <li style={{ marginBottom: 10, fontSize: 14 }}>Create a new cake or <strong>rename</strong> the current one anytime.</li>
          <li style={{ marginBottom: 10, fontSize: 14 }}>Choose a <strong>theme</strong> if you like.</li>
          <li style={{ marginBottom: 10, fontSize: 14 }}>Add achievements using <strong>+ Add toothpick</strong>.</li>
          <li style={{ marginBottom: 10, fontSize: 14 }}>Changes are saved only when you press <strong>Save</strong>.</li>
          <li style={{ marginBottom: 0, fontSize: 14 }}>Use <strong>Export</strong> to download a PNG image or JSON file.</li>
        </ul>

        <div style={{ opacity: 0.85, fontSize: 13, marginTop: 10 }}>Tip: If you close the app without saving, all unsaved changes will be lost.</div>
      </div>
    </Modal>
  );
}
