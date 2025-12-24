// src/App.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
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
  duplicateCake,
  updateCakeMetaName,
  touchCakeUpdated
} from "./storage";

function BackgroundSphere() {
  return (
    <mesh scale={40}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="#000000ff" side={THREE.BackSide} transparent opacity={0.92} />
    </mesh>
  );
}

function Cake({ onBackgroundClick }: { onBackgroundClick: () => void }) {
  return (
    <group onPointerDown={(e) => { e.stopPropagation(); onBackgroundClick(); }}>
      {/* Cake body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.4, 1.2, 48]} />
        <meshStandardMaterial color="#f2c6b6" roughness={0.9} />
      </mesh>

      {/* Frosting top */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[2.25, 2.25, 0.15, 48]} />
        <meshStandardMaterial color="#fff2f7" roughness={0.7} />
      </mesh>
      {/* Subtle shadow on ground (small, under cake) */}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#000" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
type Pick = {
  id: string;
  text: string;
  angle: number;
  radius: number;
  height: number;
};

function Toothpick({ pick, selected, onSelect }: { pick: Pick; selected: boolean; onSelect: (id: string) => void }) {
  const groupRef = useRef<THREE.Group | null>(null);
  const [hovered, setHovered] = useState(false);

  const pos = useMemo<[number, number, number]>(() => {
    const x = Math.cos(pick.angle) * pick.radius;
    const z = Math.sin(pick.angle) * pick.radius;
    return [x, pick.height, z];
  }, [pick.angle, pick.radius, pick.height]);

  const rotY = pick.angle + Math.PI / 2;

  const flagTexture = useMemo(() => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = hovered ? '#fff7cc' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111';
      ctx.font = '48px system-ui';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const maxWidth = canvas.width - 40;
      const words = String(pick.text || '').split(' ');
      let line = '';
      const lines: string[] = [];
      for (let i = 0; i < words.length; i++) {
        const test = line ? line + ' ' + words[i] : words[i];
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
  }, [pick.text, hovered]);

  return (
    <group
      ref={groupRef}
      position={pos}
      rotation={[0, rotY, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(pick.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = '';
      }}
    >
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 16]} />
        <meshStandardMaterial color={selected ? '#d35400' : '#c8a87a'} />
      </mesh>

      <mesh position={[0.18, 0.8, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.7, 0.35]} />
        <meshStandardMaterial map={flagTexture} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color={hovered ? '#ff725c' : (selected ? '#ff6b6b' : '#ffb3b3')} />
      </mesh>
    </group>
  );
}

// generatePick removed — using placeNewPick for deterministic placement

function placeNewPick(existingPicks: Pick[], text: string): Pick {
  // Uniform random placement across the cake top (full 360°) using
  // area-preserving sampling (r = sqrt(u)) and simple collision avoidance.
  // Keep storing angle+radius for compatibility with import/export schema (Option A).
  const MIN_RADIUS = 0.15; // avoid exact center if desired
  const MAX_RADIUS = 1.85; // keep picks inside the frosting rim
  const MIN_DIST = 0.34; // minimal 2D distance between picks
  const MAX_ATTEMPTS = 60;

  // helper to sample radius uniformly over annulus [MIN_RADIUS, MAX_RADIUS]
  const sampleRadius = () => {
    const r2Min = MIN_RADIUS * MIN_RADIUS;
    const r2Max = MAX_RADIUS * MAX_RADIUS;
    const u = Math.random();
    return Math.sqrt(u * (r2Max - r2Min) + r2Min);
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = sampleRadius();
    const height = 0.6; // constant height (aligned with cake top)

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

  // Fallback: sample a position ignoring collisions but using the same distribution
  const angle = Math.random() * Math.PI * 2;
  const radius = sampleRadius();
  return { id: crypto.randomUUID(), text, angle, radius, height: 0.6 } as Pick;
}

export default function App() {
  const [picks, setPicks] = useState<any[]>(() => []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const [cakesIndex, setCakesIndex] = useState(() => loadIndex());
  const [activeCakeId, setActiveCakeId] = useState<string | null>(() => getActiveCakeId());

  const selectedPick = picks.find(p => p.id === selectedId) || null;

  function openAdd() {
    setDraft("");
    setIsAddOpen(true);
    setSelectedId(null);
  }

  function addPick() {
    const text = draft.trim();
    if (!text) return;
    setPicks(prev => [...prev, placeNewPick(prev, text)]);
    setIsAddOpen(false);
  }

  function editPick(id: string) {
    const p = picks.find(x => x.id === id);
    if (!p) return;
    const text = window.prompt('Edit achievement', p.text)?.trim();
    if (!text) return;
    setPicks(prev => prev.map(x => x.id === id ? { ...x, text } : x));
  }

  function deletePick(id: string) {
    setPicks(prev => prev.filter(x => x.id !== id));
    setSelectedId(null);
  }

  function backToDefault() {
    setSelectedId(null);
    setIsAddOpen(false);
  }

  // Initialize storage / default cake on first load
  useEffect(() => {
    let idx = loadIndex();
    if (!idx) {
      const year = new Date().getFullYear();
      const name = `My ${year} Wins`;
      const created = createNewCake(name, []);
      idx = loadIndex();
      setCakesIndex(idx);
      setActiveCakeId(created.id);
      return;
    }
    setCakesIndex(idx);
    const active = idx.activeId || getActiveCakeId();
    if (active) setActiveCakeId(active);
  }, []);

  // Load picks when active cake changes
  useEffect(() => {
    if (!activeCakeId) return;
    const loaded = loadCakePicks(activeCakeId);
    setPicks(loaded || []);
    setSelectedId(null);
    // ensure active persisted
    setActiveCake(activeCakeId);
  }, [activeCakeId]);

  // Autosave picks to active cake and update index timestamp
  useEffect(() => {
    if (!activeCakeId) return;
    saveCakePicks(activeCakeId, picks);
    touchCakeUpdated(activeCakeId);
    const idx = loadIndex();
    setCakesIndex(idx);
  }, [picks, activeCakeId]);

  const handleSelectCake = useCallback((id: string) => {
    setActiveCakeId(id);
    setActiveCake(id);
  }, []);

  const handleNewCake = useCallback(() => {
    const name = window.prompt("Name for new cake?", "")?.trim();
    if (!name) return;
    const created = createNewCake(name, []);
    const idx = loadIndex();
    setCakesIndex(idx);
    setActiveCakeId(created.id);
  }, []);

  const handleDuplicate = useCallback(() => {
    if (!activeCakeId) return;
    const res = duplicateCake(activeCakeId);
    if (!res) return;
    const idx = loadIndex();
    setCakesIndex(idx);
    setActiveCakeId(res.id);
  }, [activeCakeId]);

  const handleRename = useCallback(() => {
    if (!activeCakeId) return;
    const idx = loadIndex();
    const meta = idx?.cakes.find(c => c.id === activeCakeId);
    const current = meta?.name || "";
    const name = window.prompt("Rename cake", current)?.trim();
    if (!name) return;
    updateCakeMetaName(activeCakeId, name);
    setCakesIndex(loadIndex());
  }, [activeCakeId]);

  const handleDelete = useCallback(() => {
    if (!activeCakeId) return;
    const ok = window.confirm("Delete this cake? This cannot be undone.");
    if (!ok) return;
    const newIdx = deleteCake(activeCakeId);
    if (!newIdx) {
      setCakesIndex(loadIndex());
      setActiveCakeId(null);
      return;
    }
    setCakesIndex(newIdx);
    setActiveCakeId(newIdx.activeId || null);
  }, [activeCakeId]);

  const handleExport = useCallback(() => {
    if (!activeCakeId) return;
    const picksData = loadCakePicks(activeCakeId);
    const idx = loadIndex();
    const name = idx?.cakes.find(c => c.id === activeCakeId)?.name || "cake";
    const blob = new Blob([JSON.stringify({ name, picks: picksData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.cake.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeCakeId]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const handleImportClick = useCallback(() => fileRef.current?.click(), []);
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const picks = parsed.picks ?? parsed;
        const name = parsed.name || `Imported ${new Date().toISOString()}`;
        const createNew = window.confirm('Create new cake from import? Click Cancel to overwrite current cake.');
        if (createNew) {
          const created = createNewCake(name, picks);
          setCakesIndex(loadIndex());
          setActiveCakeId(created.id);
        } else {
          if (!activeCakeId) return;
          saveCakePicks(activeCakeId, picks);
          touchCakeUpdated(activeCakeId);
          setPicks(picks);
          setCakesIndex(loadIndex());
        }
      } catch (err) {
        console.error(err);
        window.alert('Failed to import file');
      }
    };
    reader.readAsText(f);
  }, [activeCakeId]);

  return (
    <div style={{ height: "100vh", width: "100vw", background: "radial-gradient(ellipse at 20% 10%, #0f1724 0%, #071026 36%, #030512 100%)", position: "relative" }}>
      {/* UI overlay */}
      <div style={{
        position: "absolute",
        top: 16,
        left: 16,
        right: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        zIndex: 10
      }}>
          <div style={{ color: "white", fontFamily: "system-ui", fontSize: 16 }}>
            Achievement Cake (virtual)
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: 'center' }}>
            <label style={{ color: 'white', fontSize: 13, marginRight: 8 }}>Current cake</label>
            <select
              value={activeCakeId ?? ''}
              onChange={(e) => handleSelectCake(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'white' }}
            >
              {(cakesIndex?.cakes ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button onClick={handleNewCake} style={btnStyleSecondary}>New cake</button>
            <button onClick={handleRename} style={btnStyleSecondary}>Rename</button>
            <button onClick={handleDelete} style={btnStyleSecondary}>Delete</button>
            <button onClick={handleDuplicate} style={btnStyleSecondary}>Duplicate</button>
            <button onClick={handleExport} style={btnStyleSecondary}>Export</button>
            <button onClick={handleImportClick} style={btnStyleSecondary}>Import</button>

            <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFile} />

            <button
              onClick={openAdd}
              style={btnStyle}
            >
              + Add toothpick
            </button>

            
          </div>
      </div>

      {/* Selected panel */}
      {selectedPick && !isAddOpen && (
        <div style={panelStyle}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Selected toothpick</div>
          <div style={{ opacity: 0.95 }}>{selectedPick.text}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => editPick(selectedPick.id)} style={btnStyle}>Edit</button>
            <button onClick={() => deletePick(selectedPick.id)} style={btnStyleSecondary}>Delete</button>
          </div>
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
            Tip: click empty space to deselect
          </div>
        </div>
      )}

      {/* Add modal */}
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
              <button onClick={() => setIsAddOpen(false)} style={btnStyleSecondary}>Cancel</button>
              <button onClick={addPick} style={btnStyle}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* 3D */}
      <Canvas camera={{ position: [0, 3.2, 6], fov: 45 }} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
        <BackgroundSphere />
        <ambientLight intensity={0.6} />
        <hemisphereLight args={[0xffffff, 0x222233, 0.25]} />
        <directionalLight position={[6, 8, 4]} intensity={0.9} />
        <pointLight position={[-4, 4, -2]} intensity={0.35} />

        <OrbitControls
          enablePan={false}
          minDistance={4.5}
          maxDistance={8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
        />

        <group position={[0, -0.3, 0]}>
          <Cake onBackgroundClick={() => setSelectedId(null)} />
          {picks.map(p => (
            <Toothpick
              key={p.id}
              pick={p}
              selected={p.id === selectedId}
              onSelect={setSelectedId}
            />
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
  fontWeight: 700
};

const btnStyleSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.18)",
  padding: "10px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700
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
  backdropFilter: "blur(8px)"
};

const modalOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 20
};

const modalCard: React.CSSProperties = {
  width: 520,
  maxWidth: "calc(100% - 32px)",
  background: "#151525",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  padding: 16,
  color: "white",
  fontFamily: "system-ui"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  outline: "none",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontSize: 14
};
