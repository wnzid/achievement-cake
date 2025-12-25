import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import TextInputModal from "./components/TextInputModal";
import ConfirmModal from "./components/ConfirmModal";
import HowToModal from "./components/HowToModal";
import Toast from "./components/Toast";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  loadIndex,
  loadCakePicks,
  saveCakePicks,
  createNewCake,
  setActiveCake,
  getActiveCakeId,
  deleteCake,
  updateCakeMetaName,
  touchCakeUpdated,
  updateCakeTheme,
  cakeKey,
} from "./storage";
import { themes, getThemeById, defaultThemeId } from "./themes";
import type { Theme } from "./themes";

function BackgroundSphere() {
  return (
    <mesh scale={40}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#ffffffff" side={THREE.BackSide} transparent opacity={0.92} />
    </mesh>
  );
}

function makeWaveCombTexture(size = 1024) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);

  const rings = 95;
  const depth = 36;
  const wobbleAmp = 2.2;
  const wobbleFreq = 2.0;

  for (let y = 0; y < size; y++) {
    const v = y / size;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const wobble = Math.sin(u * Math.PI * 2 * wobbleFreq) * wobbleAmp;
      const comb = Math.sin((v * rings + wobble / size) * Math.PI * 2);
      const h = 128 + comb * depth;

      const i = (y * size + x) * 4;
      img.data[i] = h;
      img.data[i + 1] = h;
      img.data[i + 2] = h;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  ctx.globalAlpha = 1;
  ctx.filter = "blur(0.6px)";
  ctx.drawImage(c, 0, 0);
  ctx.filter = "none";

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function Cake({
  onBackgroundClick,
  theme,
  exportMode,
}: {
  onBackgroundClick: () => void;
  theme: Theme;
  exportMode?: boolean;
}) {
  const icing = theme.cake.body || theme.cake.frosting;
  const combTex = useMemo(() => makeWaveCombTexture(1024), []);

  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(icing),
      roughness: 0.72,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.55,
      bumpMap: combTex || undefined,
      bumpScale: 0.045,
      roughnessMap: combTex || undefined,
    });

    return m;
  }, [icing, combTex]);

  return (
    <group
      onPointerDown={(e) => {
        e.stopPropagation();
        onBackgroundClick();
      }}
    >
      <mesh position={[0, 0, 0]} material={mat}>
        <cylinderGeometry args={[2.2, 2.4, 1.2, 128, 4]} />
      </mesh>

      {!exportMode && (
        <group>
          <mesh position={[0, -0.66, 0]}>
            <cylinderGeometry args={[2.6, 2.6, 0.1, 64]} />
            <meshStandardMaterial color="#e6e1da" roughness={0.92} metalness={0} />
          </mesh>

          <mesh position={[0, -0.61, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.6, 0.03, 16, 96]} />
            <meshStandardMaterial color="#d6d1c9" roughness={0.95} metalness={0} />
          </mesh>

          <mesh position={[0, -0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[2.8, 64]} />
            <meshStandardMaterial color="#000" transparent opacity={0.08} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function CaptureBridge({ onReady }: { onReady: (payload: any) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => onReady({ gl, scene, camera }), [gl, scene, camera, onReady]);
  return null;
}

type Pick = {
  id: string;
  text: string;
  angle: number;
  radius: number;
  height: number;
};

function Toothpick({
  pick,
  selected,
  onSelect,
  theme,
}: {
  pick: Pick;
  selected: boolean;
  onSelect: (id: string) => void;
  theme: Theme;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const [hovered, setHovered] = useState(false);

  const stickH = 1.2;
  const flagY = 0.8;
  const flagH = 0.35;
  const stickY = flagY - flagH / 2 - stickH / 2;
  const flagDepth = 0.04;

  const pos = useMemo<[number, number, number]>(() => {
    const x = Math.cos(pick.angle) * pick.radius;
    const z = Math.sin(pick.angle) * pick.radius;
    return [x, pick.height, z];
  }, [pick.angle, pick.radius, pick.height]);

  const rotY = pick.angle + Math.PI / 2;

  function lightenHex(hex: string, percent: number) {
    try {
      const h = hex.replace("#", "");
      const num = parseInt(h, 16);
      let r = num >> 16;
      let g = (num >> 8) & 0x00ff;
      let b = num & 0x0000ff;
      r = Math.max(0, Math.min(255, Math.round(r + (255 - r) * (percent / 100))));
      g = Math.max(0, Math.min(255, Math.round(g + (255 - g) * (percent / 100))));
      b = Math.max(0, Math.min(255, Math.round(b + (255 - b) * (percent / 100))));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) {
      return hex;
    }
  }

  const flagTexture = useMemo(() => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const flagPaper = theme.flag.paper || "#fff7eb";
      const flagFill = selected || hovered ? lightenHex(flagPaper, 6) : flagPaper;

      ctx.fillStyle = flagFill;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = theme.flag.text || "#3b2416";
      ctx.font = "48px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const maxWidth = canvas.width - 40;
      const words = String(pick.text || "").split(" ");
      let line = "";
      const lines: string[] = [];

      for (let i = 0; i < words.length; i++) {
        const test = line ? line + " " + words[i] : words[i];
        const w = ctx.measureText(test).width;
        if (w > maxWidth && line) {
          lines.push(line);
          line = words[i];
          if (lines.length >= 2) break;
        } else {
          line = test;
        }
      }

      if (lines.length < 2 && line) lines.push(line);

      const startY = canvas.height / 2 - (lines.length - 1) * 26;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 20, startY + i * 52, maxWidth);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    } catch (e) {
      return null;
    }
  }, [pick.text, hovered, selected, theme.flag.paper, theme.flag.text]);

  return (
    <group
      ref={groupRef}
      position={[pos[0], pos[1] + (selected ? 0.06 : 0), pos[2]]}
      rotation={[0, rotY, 0]}
      scale={selected ? 1.04 : 1}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(pick.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, stickY, 0]}>
        <cylinderGeometry args={[0.03, 0.03, stickH, 16]} />
        <meshStandardMaterial
          color={selected ? lightenHex(theme.toothpick.stick, 12) : theme.toothpick.stick}
        />
      </mesh>

      <mesh visible={selected} position={[0.18, flagY, -0.0015]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.74, flagH + 0.02, flagDepth]} />
        <meshStandardMaterial color={theme.accent.primary} roughness={0.9} metalness={0} />
      </mesh>

      <mesh position={[0.18, flagY, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.7, flagH, flagDepth]} />
        <meshStandardMaterial map={flagTexture as any} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function placeNewPick(existingPicks: Pick[], text: string): Pick {
  const MIN_RADIUS = 0.15;
  const MAX_RADIUS = 1.85;
  const MIN_DIST = 0.34;
  const MAX_ATTEMPTS = 60;

  const sampleRadius = () => {
    const r2Min = MIN_RADIUS * MIN_RADIUS;
    const r2Max = MAX_RADIUS * MAX_RADIUS;
    const u = Math.random();
    return Math.sqrt(u * (r2Max - r2Min) + r2Min);
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = sampleRadius();
    const height = 0.6;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    let ok = true;
    for (const p of existingPicks) {
      const px = Math.cos(p.angle) * p.radius;
      const pz = Math.sin(p.angle) * p.radius;
      const dx = px - x;
      const dz = pz - z;
      if (Math.hypot(dx, dz) < MIN_DIST) {
        ok = false;
        break;
      }
    }

    if (ok) return { id: crypto.randomUUID(), text, angle, radius, height } as Pick;
  }

  const angle = Math.random() * Math.PI * 2;
  const radius = sampleRadius();
  return { id: crypto.randomUUID(), text, angle, radius, height: 0.6 } as Pick;
}

export default function App() {
  const [picks, setPicks] = useState<any[]>(() => []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingPick, setEditingPick] = useState<{ id: string; value: string } | null>(null);

  const [newCakeOpen, setNewCakeOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [importPending, setImportPending] = useState<{ name: string; picks: any[] } | null>(null);

  const [cakesIndex, setCakesIndex] = useState(() => loadIndex());
  const [activeCakeId, setActiveCakeId] = useState<string | null>(() => getActiveCakeId());
  const [defaultThemeSelection, setDefaultThemeSelection] = useState<string>("chocolate");

  const activeCakeMeta = cakesIndex?.cakes.find((c) => c.id === activeCakeId) ?? null;
  const resolvedThemeId = activeCakeId === "default" ? defaultThemeSelection : activeCakeMeta?.themeId ?? defaultThemeId;
  const theme = getThemeById(resolvedThemeId);

  const selectedPick = picks.find((p) => p.id === selectedId) || null;
  const hydratedRef = useRef(false);
  const hydrateTimerRef = useRef<number | null>(null);

  const [addHover, setAddHover] = useState(false);
  const [importHover, setImportHover] = useState(false);
  const [exportHover, setExportHover] = useState(false);
  const [importActive, setImportActive] = useState(false);
  const [exportActive, setExportActive] = useState(false);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" }>({ visible: false, message: "", type: "success" });
  const [saving, setSaving] = useState(false);

  const threeRef = useRef<any>(null);
  const handleThreeReady = useCallback((payload: any) => {
    threeRef.current = payload;
  }, []);

  function openAbout() {
    setAboutOpen(true);
  }
  function closeAbout() {
    setAboutOpen(false);
  }

  function shadeHex(hex: string, percent: number) {
    const h = hex.replace("#", "");
    const num = parseInt(h, 16);
    let r = (num >> 16) + Math.round(255 * (percent / 100));
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
    let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function isLight(hex: string) {
    const h = hex.replace("#", "");
    const num = parseInt(h, 16);
    const r = num >> 16;
    const g = (num >> 8) & 0x00ff;
    const b = num & 0x0000ff;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 180;
  }

  const themedPrimaryBg = (() => {
    const base = theme.accent.primary || "#c47f2a";
    const top = shadeHex(base, 18);
    const bottom = shadeHex(base, -12);
    return `linear-gradient(180deg, ${top}, ${bottom})`;
  })();

  const themedPrimaryHoverBg = (() => {
    const base = theme.accent.primary || "#c47f2a";
    const top = shadeHex(base, 28);
    const bottom = shadeHex(base, 0);
    return `linear-gradient(180deg, ${top}, ${bottom})`;
  })();

  const rimLights = useMemo(() => {
    const count = 24;
    const radius = 6.5;
    const height = 4.2;
    const intensity = 0.32;
    const arr: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const x = Math.cos(ang) * radius;
      const z = Math.sin(ang) * radius;
      arr.push([x, height, z]);
    }
    return { arr, intensity };
  }, []);

  function primaryStyle(hover = false): React.CSSProperties {
    const base = theme.accent.primary || "#c47f2a";
    return {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "none",
      background: hover ? themedPrimaryHoverBg : themedPrimaryBg,
      color: isLight(base) ? "#1b1007" : "#ffffff",
      fontWeight: 800,
      cursor: "pointer",
      boxShadow: "0 6px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
    } as React.CSSProperties;
  }

  const secondaryBtnStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${theme.ui.cardBorder || "rgba(255,215,160,0.18)"}`,
    background: "rgba(255,255,255,0.03)",
    color: theme.ui.textPrimary || "#fff",
    marginBottom: 8,
    cursor: "pointer",
  };

  const destructiveBtnStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(190,60,60,0.35)",
    background: "rgba(190,60,60,0.15)",
    color: "#ffdede",
    marginBottom: 8,
    cursor: "pointer",
  };

  function openAdd() {
    setDraft("");
    setIsAddOpen(true);
    setSelectedId(null);
  }

  function addPick() {
    const text = draft.trim();
    if (!text) return;
    setPicks((prev) => [...prev, placeNewPick(prev, text)]);
    setIsAddOpen(false);
  }

  function editPick(id: string) {
    const p = picks.find((x) => x.id === id);
    if (!p) return;
    setEditingPick({ id, value: p.text });
  }

  function submitEditPick(value: string) {
    if (!editingPick) return;
    const text = value.trim();
    if (!text) {
      setEditingPick(null);
      return;
    }
    setPicks((prev) => prev.map((x) => (x.id === editingPick.id ? { ...x, text } : x)));
    setEditingPick(null);
  }

  function deletePick(id: string) {
    setPicks((prev) => prev.filter((x) => x.id !== id));
    setSelectedId(null);
  }

  useEffect(() => {
    const idx = loadIndex();

    if (!idx || (Array.isArray(idx.cakes) && idx.cakes.length === 0)) {
      setCakesIndex({ cakes: [], activeId: null });
      setActiveCakeId("default");
      setPicks([]);
      return;
    }
    setCakesIndex(idx);
    const active = idx.activeId || idx.cakes[0]?.id || null;
    setActiveCakeId(active);
  }, []);

  useEffect(() => {
    hydratedRef.current = false;
    if (hydrateTimerRef.current) {
      window.clearTimeout(hydrateTimerRef.current);
      hydrateTimerRef.current = null;
    }
    if (!activeCakeId) return;
    
    if (activeCakeId === "default") {
      setPicks([]);
      setSelectedId(null);
      return;
    }

    const loaded = loadCakePicks(activeCakeId);
    try {
      console.debug("load picks:", activeCakeId, { raw: localStorage.getItem(cakeKey(activeCakeId)) });
    } catch (e) {}

    setPicks(loaded || []);
    setSelectedId(null);
    setActiveCake(activeCakeId);

    hydrateTimerRef.current = window.setTimeout(() => {
      hydratedRef.current = true;
      hydrateTimerRef.current = null;
    }, 0) as unknown as number;
  }, [activeCakeId]);

  useEffect(() => {
    if (!activeCakeId) return;
    if (activeCakeId === "default") return;
    if (!hydratedRef.current) return;
    saveCakePicks(activeCakeId, picks);
    touchCakeUpdated(activeCakeId);
    const idx = loadIndex();
    setCakesIndex(idx);
  }, [picks, activeCakeId]);

  const handleSelectCake = useCallback((id: string) => {
    setActiveCakeId(id);
    if (id !== "default") setActiveCake(id);
  }, []);

  const handleNewCake = useCallback(() => {
    setNewCakeOpen(true);
  }, []);

  function setThemeForActiveCake(themeId: string) {
    if (!activeCakeId) return;
    if (activeCakeId === "default") {
      setDefaultThemeSelection(themeId);
      return;
    }
    updateCakeTheme(activeCakeId, themeId);
    setCakesIndex(loadIndex());
  }

  const handleRename = useCallback(() => {
    if (!activeCakeId) return;
    setRenameOpen(true);
  }, [activeCakeId]);

  const handleDelete = useCallback(() => {
    if (!activeCakeId) return;
    setDeleteConfirmOpen(true);
  }, [activeCakeId]);

  const handleExport = useCallback(() => {
    if (!activeCakeId) return;
    const picksData = loadCakePicks(activeCakeId);
    const idx = loadIndex();
    const name = idx?.cakes.find((c) => c.id === activeCakeId)?.name || "cake";
    const blob = new Blob([JSON.stringify({ name, picks: picksData }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}.cake.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeCakeId]);

  function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function exportJson() {
    handleExport();
    setIsExportOpen(false);
  }

  async function exportPng() {
    const three = threeRef.current;
    if (!three) return;

    setExportMode(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          three.gl.render(three.scene, three.camera);
          const dataUrl = three.gl.domElement.toDataURL("image/png");
          const idx = loadIndex();
          const cakeName = idx?.cakes?.find((c: any) => c.id === activeCakeId)?.name ?? "cake";
          const safe = cakeName.replace(/[^\w\-]+/g, "_");
          downloadDataUrl(dataUrl, `${safe}.png`);
        } finally {
          setExportMode(false);
          setIsExportOpen(false);
        }
      });
    });
  }

  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const picks = parsed.picks ?? parsed;
          const name = parsed.name || `Imported ${new Date().toISOString()}`;
          setImportPending({ name, picks });
        } catch (err) {
          console.error(err);
          window.alert("Failed to import file");
        }
      };
      reader.readAsText(f);
    },
    [activeCakeId]
  );

  function saveNow() {
    setSaving(true);
    try {
      if (activeCakeId === "default") {
        const created = createNewCake("Default Cake", picks, defaultThemeSelection);
        setActiveCakeId(created.id);
        setCakesIndex(loadIndex());
        setToast({ visible: true, message: "Cake saved successfully", type: "success" });
        setSaving(false);
        return;
      }

      if (!activeCakeId) {
        setToast({ visible: true, message: "Could not save cake. No active cake.", type: "error" });
        setSaving(false);
        return;
      }

      saveCakePicks(activeCakeId, picks);
      touchCakeUpdated(activeCakeId);
      setCakesIndex(loadIndex());
      setToast({ visible: true, message: "Cake saved successfully", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ visible: true, message: "Could not save cake. Please try again.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function submitNewCake(name: string) {
    const n = name.trim();
    if (!n) return setNewCakeOpen(false);
    const created = createNewCake(n, []);
    const idx = loadIndex();
    setCakesIndex(idx);
    setActiveCakeId(created.id);
    setNewCakeOpen(false);
  }

  function submitRename(name: string) {
    const n = name.trim();
    if (!n || !activeCakeId) {
      setRenameOpen(false);
      return;
    }
    updateCakeMetaName(activeCakeId, n);
    setCakesIndex(loadIndex());
    setRenameOpen(false);
  }

  function confirmDelete() {
    if (!activeCakeId) return setDeleteConfirmOpen(false);
    const newIdx = deleteCake(activeCakeId);
    if (!newIdx) {
      setCakesIndex(loadIndex());
      setActiveCakeId(null);
      setDeleteConfirmOpen(false);
      return;
    }
    setCakesIndex(newIdx);
    setActiveCakeId(newIdx.activeId || null);
    setDeleteConfirmOpen(false);
  }

  function importCreateNew() {
    if (!importPending) return setImportPending(null);
    const created = createNewCake(importPending.name, importPending.picks);
    setCakesIndex(loadIndex());
    setActiveCakeId(created.id);
    try {
      console.debug("importCreateNew saved:", created.id, { raw: localStorage.getItem(cakeKey(created.id)) });
    } catch (e) {}
    setImportPending(null);
  }

  function importOverwrite() {
    if (!importPending) return setImportPending(null);
    if (!activeCakeId) {
      setImportPending(null);
      return;
    }
    saveCakePicks(activeCakeId, importPending.picks);
    touchCakeUpdated(activeCakeId);
    setPicks(importPending.picks);
    setCakesIndex(loadIndex());
    setImportPending(null);
  }

  return (
    <div style={{ height: "100vh", width: "100vw", background: theme.backgroundGradient, position: "relative" }}>
      <div style={{ position: "absolute", left: 16, top: 56, width: 320, zIndex: 11 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              position: "relative",
              background: theme.ui.cardBg,
              border: `1px solid ${theme.ui.cardBorder}`,
              color: theme.ui.textPrimary,
              backdropFilter: "blur(12px)",
              padding: 12,
              borderRadius: 12,
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.ui.textPrimary, opacity: 0.98, marginBottom: 6 }}>
              Achievement Cake
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "6px 0 8px" }} />

            <div style={{ fontWeight: 800, marginBottom: 8, color: theme.ui.textPrimary }}>Context</div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: theme.ui.textMuted ?? theme.ui.textSecondary }}>
                Cake
              </div>
              <select
                value={activeCakeId ?? ""}
                onChange={(e) => handleSelectCake(e.target.value)}
                style={{
                  width: "100%",
                  height: 44,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: `1px solid ${theme.ui.cardBorder}`,
                  background: "rgba(255,255,255,0.03)",
                  color: theme.ui.textPrimary,
                  fontSize: 14,
                  outline: "none",
                  appearance: "none",
                  cursor: "pointer",
                }}
              >
                {(!cakesIndex || (Array.isArray(cakesIndex.cakes) && cakesIndex.cakes.length === 0)) ? (
                  <option value="default">Default Cake</option>
                ) : (
                  <option value="">Select a cake</option>
                )}
                {(cakesIndex?.cakes ?? []).map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    style={{ color: isLight(theme.ui.textPrimary) ? "#1b1007" : theme.ui.textPrimary }}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: theme.ui.textMuted ?? theme.ui.textSecondary }}>
                Theme
              </div>
              <select
                value={resolvedThemeId}
                onChange={(e) => setThemeForActiveCake(e.target.value)}
                style={{
                  width: "100%",
                  height: 44,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: `1px solid ${theme.ui.cardBorder}`,
                  background: "rgba(255,255,255,0.03)",
                  color: theme.ui.textPrimary,
                  fontSize: 14,
                  outline: "none",
                  appearance: "none",
                  cursor: "pointer",
                }}
              >
                {themes.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    style={{ color: isLight(t.ui?.textPrimary || theme.ui.textPrimary) ? "#1b1007" : t.ui?.textPrimary || theme.ui.textPrimary }}
                  >
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: 12, color: "#c94b5e", marginTop: 6 }}>{picks.length} toothpicks</div>

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button
                onClick={openAbout}
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${theme.ui.cardBorder}`,
                  background: "rgba(255,255,255,0.04)",
                  color: theme.ui.textPrimary,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ℹ About the Project
              </button>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              background: theme.ui.cardBg,
              border: `1px solid ${theme.ui.cardBorder}`,
              color: theme.ui.textPrimary,
              backdropFilter: "blur(12px)",
              padding: 12,
              borderRadius: 12,
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <button onClick={() => setHowOpen(true)} style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              border: `1px solid ${theme.ui.cardBorder}`,
              background: 'rgba(255,255,255,0.04)',
              color: theme.ui.textPrimary,
              fontWeight: 700,
              cursor: 'pointer'
            }}>How to use</button>
          </div>
        </div>
      </div>

      <div
        style={{
          ...sideCardStyle,
          background: theme.ui.cardBg,
          border: `1px solid ${theme.ui.cardBorder}`,
          color: theme.ui.textPrimary,
          backdropFilter: "blur(14px)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8, color: theme.ui.textPrimary }}>Controls</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ ...sectionTitleStyle, color: theme.ui.textMuted ?? theme.ui.textSecondary }}>Cake actions</div>
          <button onClick={handleNewCake} style={secondaryBtnStyle}>
            Bake New Cake
          </button>
          <button onClick={handleRename} style={secondaryBtnStyle}>
            Rename Cake
          </button>
          <button onClick={handleDelete} style={destructiveBtnStyle}>
            Throw Away Cake
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ ...sectionTitleStyle, color: theme.ui.textMuted ?? theme.ui.textSecondary }}>Data</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: 6,
            }}
          >
            <button
              title="Import (.cake.json)"
              onClick={() => fileRef.current?.click()}
              onMouseEnter={() => setImportHover(true)}
              onMouseLeave={() => setImportHover(false)}
              onMouseDown={() => setImportActive(true)}
              onMouseUp={() => setImportActive(false)}
              style={{
                ...secondaryBtnStyle,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 8px",
                justifyContent: "flex-start",
                background: importActive
                  ? "rgba(255,215,160,0.20)"
                  : importHover
                    ? "rgba(255,215,160,0.14)"
                    : "rgba(255,255,255,0.06)",
                color: theme.ui.textPrimary,
                height: 40,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                transform: importActive ? "translateY(1px)" : "none",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ flex: "0 0 18px" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4 4-4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21H3" />
              </svg>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Import</div>
            </button>

            <button
              title="Export"
              onClick={() => setIsExportOpen(true)}
              onMouseEnter={() => setExportHover(true)}
              onMouseLeave={() => setExportHover(false)}
              onMouseDown={() => setExportActive(true)}
              onMouseUp={() => setExportActive(false)}
              style={{
                ...secondaryBtnStyle,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                justifyContent: "flex-start",
                background: exportActive
                  ? "rgba(255,215,160,0.20)"
                  : exportHover
                    ? "rgba(255,215,160,0.14)"
                    : "rgba(255,255,255,0.06)",
                color: theme.ui.textPrimary,
                height: 40,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                transform: exportActive ? "translateY(1px)" : "none",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ flex: "0 0 18px" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21V9m0 0l-4 4m4-4 4 4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 3h16" />
              </svg>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Export</div>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleFile} />

          <div style={{ marginTop: 8 }}>
            <button disabled={saving} onClick={saveNow} style={{ ...secondaryBtnStyle, width: "100%", opacity: saving ? 0.6 : 1, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9, color: theme.ui.textMuted ?? theme.ui.textSecondary }}>
            Please save or else everything will be lost when closed.
          </div>
        </div>

        <div>
          <div style={{ ...sectionTitleStyle, color: theme.ui.textMuted ?? theme.ui.textSecondary }}>Toothpicks</div>
          <button onMouseEnter={() => setAddHover(true)} onMouseLeave={() => setAddHover(false)} onClick={openAdd} style={primaryStyle(addHover)}>
            + Add toothpick
          </button>
        </div>
      </div>

      {selectedPick && !isAddOpen && (
        <div style={{ ...panelStyle, background: theme.ui.cardBg, border: `1px solid ${theme.ui.cardBorder}`, color: theme.ui.textPrimary }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: theme.ui.textPrimary }}>Selected toothpick</div>
          <div
            style={{
              opacity: 0.95,
              maxWidth: "100%",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              whiteSpace: "normal",
              textOverflow: "ellipsis",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {selectedPick.text}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => editPick(selectedPick.id)}
              style={{ ...btnStyle, background: "transparent", color: theme.ui.textPrimary, border: `1px solid ${theme.ui.cardBorder}` }}
            >
              Edit
            </button>
            <button
              onClick={() => deletePick(selectedPick.id)}
              style={{
                ...btnStyleSecondary,
                background: "rgba(255,255,255,0.04)",
                color: "#ffdede",
                border: "1px solid rgba(190,60,60,0.25)",
              }}
            >
              Delete
            </button>
          </div>
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>Tip: click empty space to deselect</div>
        </div>
      )}

      {isAddOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Add an achievement</div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g., Passed my exam / got a new job / kept going…"
              style={inputStyle}
              maxLength={60}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setIsAddOpen(false)} style={btnStyleSecondary}>
                Cancel
              </button>
              <button onClick={addPick} style={btnStyle}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <TextInputModal
        open={!!editingPick}
        title="Edit achievement"
        initialValue={editingPick?.value ?? ""}
        placeholder="Achievement text"
        onCancel={() => setEditingPick(null)}
        onSubmit={submitEditPick}
      />

      <TextInputModal open={newCakeOpen} title="New cake" initialValue={""} placeholder="Name for new cake" onCancel={() => setNewCakeOpen(false)} onSubmit={submitNewCake} />

      <TextInputModal
        open={renameOpen}
        title="Rename cake"
        initialValue={(cakesIndex?.cakes ?? []).find((c) => c.id === activeCakeId)?.name ?? ""}
        placeholder="Rename cake"
        onCancel={() => setRenameOpen(false)}
        onSubmit={submitRename}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        title="Delete cake?"
        message={"Delete this cake? This cannot be undone."}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />

      {importPending && (
        <ConfirmModal
          open={!!importPending}
          title="Import cake"
          message={
            <>
              Import <strong style={{ color: "white" }}>{importPending.name}</strong>. Create new or overwrite current cake?
            </>
          }
          confirmLabel="Create new"
          cancelLabel="Overwrite"
          onCancel={importOverwrite}
          onConfirm={importCreateNew}
        />
      )}

      <ConfirmModal
        open={aboutOpen}
        title="About"
        message={
          <>
            <div style={{ lineHeight: 1.45 }}>
              <div style={{ marginBottom: 10 }}>
                This project was inspired by my girlfriend. Since we’re in a long-distance relationship, doing this virtually was the only option. Distance didn’t stop the idea, and it didn’t stop the love either.
              </div>
              <div style={{ opacity: 0.85, fontSize: 13 }}>Thank you for your love, care, support, and motivation. I love you so much. ❤️</div>
            </div>
          </>
        }
        confirmLabel="Close"
        cancelLabel=""
        onCancel={closeAbout}
        onConfirm={closeAbout}
      />

      <HowToModal open={howOpen} onClose={() => setHowOpen(false)} theme={theme} />

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onClose={() => setToast((t) => ({ ...t, visible: false }))} />

      {isExportOpen && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Export</div>
            <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 14 }}>Choose a format to export this cake.</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btnStyleSecondary} onClick={() => exportJson()}>
                Export JSON
              </button>
              <button style={btnStyle} onClick={() => exportPng()}>
                Export PNG (cake only)
              </button>
              <button style={btnStyleSecondary} onClick={() => setIsExportOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 3.2, 6], fov: 45 }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} style={{ background: "transparent" }}>
        <CaptureBridge onReady={handleThreeReady} />
        <BackgroundSphere />
        <ambientLight intensity={0.6} />
        <hemisphereLight args={[0xffffff, 0x222233, 0.25]} />
        <directionalLight position={[6, 8, 4]} intensity={0.9} />
        <pointLight position={[-4, 4, -2]} intensity={0.35} />
        <spotLight position={[0, 6, 2]} intensity={0.6} angle={0.6} penumbra={0.6} decay={2} distance={12} color={0xfff2e6} />
        <pointLight position={[0, 2.8, 5]} intensity={0.28} distance={10} decay={2} color={0xffffff} />

        {rimLights.arr.map((p, i) => (
          <pointLight key={`rim-${i}`} position={p} intensity={rimLights.intensity} distance={12} decay={2} color={0xffffff} />
        ))}

        <OrbitControls enablePan={false} minDistance={4.5} maxDistance={8} minPolarAngle={Math.PI / 6} maxPolarAngle={Math.PI / 2.2} />

        <group position={[0, -0.3, 0]}>
          <Cake onBackgroundClick={() => setSelectedId(null)} theme={theme} exportMode={exportMode} />
          {picks.map((p) => (
            <Toothpick key={p.id} pick={p} selected={p.id === selectedId} onSelect={setSelectedId} theme={theme} />
          ))}
        </group>
      </Canvas>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#111",
  border: "none",
  padding: "10px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const btnStyleSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.18)",
  padding: "10px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const panelStyle: React.CSSProperties = {
  position: "absolute",
  left: 16,
  bottom: 16,
  width: 360,
  maxWidth: "calc(100% - 32px)",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "white",
  padding: 14,
  borderRadius: 14,
  fontFamily: "system-ui",
  zIndex: 10,
  backdropFilter: "blur(8px)",
};

const sideCardStyle: React.CSSProperties = {
  position: "absolute",
  right: 16,
  top: 56,
  width: 280,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "white",
  padding: 14,
  borderRadius: 12,
  zIndex: 12,
  backdropFilter: "blur(8px)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "white",
  opacity: 0.9,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 8,
};

const modalOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 20,
};

const modalCard: React.CSSProperties = {
  width: 520,
  maxWidth: "calc(100% - 32px)",
  background: "#151525",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  boxSizing: "border-box",
  padding: 16,
  color: "white",
  fontFamily: "system-ui",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  display: "block",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  outline: "none",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 14,
};
