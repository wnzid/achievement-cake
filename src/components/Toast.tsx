import { useEffect } from "react";

export default function Toast({ visible, message, type = "success", onClose }: { visible: boolean; message: string; type?: "success" | "error"; onClose: () => void; }) {
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => onClose(), 3000);
    return () => window.clearTimeout(t);
  }, [visible, onClose]);

  if (!visible) return null;

  const bg = type === "success" ? "#2ecc71" : "#e74c3c";

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 9999 }}>
      <div style={{ transform: "translateY(0)", transition: "transform 220ms ease, opacity 220ms ease", opacity: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 200, padding: "12px 16px", borderRadius: 10, background: bg, color: "#fff", fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
          <div style={{ fontSize: 16 }}>{type === "success" ? "✓" : "⚠"}</div>
          <div style={{ fontSize: 14 }}>{message}</div>
        </div>
      </div>
    </div>
  );
}
