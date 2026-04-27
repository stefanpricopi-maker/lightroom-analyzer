"use client";

import { useState, useEffect, useMemo } from "react";
import {
  loadPresets, loadCollections, saveCollection, deleteCollection,
  updatePreset, deletePreset,
  getAllCollectionNames, DEFAULT_COLLECTION_NAME,
  type SavedPreset,
} from "@/app/lib/presetStorage";
import { toast } from "@/app/lib/toast";

interface PresetLibraryProps {
  onLoad: (preset: SavedPreset) => void;
  onClose?: () => void;
}

export function PresetLibrary({ onLoad, onClose }: PresetLibraryProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [collections, setCollections] = useState<{ name: string; createdAt: number }[]>([]);
  const [activeCollection, setActiveCollection] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [movingPreset, setMovingPreset] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setPresets(loadPresets());
    setCollections(loadCollections());
  }, [open]);

  const refresh = () => {
    setPresets(loadPresets());
    setCollections(loadCollections());
  };

  const collectionNames = useMemo(
    () => getAllCollectionNames(presets, collections),
    [presets, collections]
  );

  const filtered = useMemo(() => {
    let list = presets;
    if (activeCollection !== "__all__") {
      list = list.filter((p) => p.collection === activeCollection);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.result.style_summary?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [presets, activeCollection, search]);

  const handleCreateCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;
    saveCollection(name);
    setNewCollectionName("");
    setShowNewCollection(false);
    refresh();
  };

  const handleDeleteCollection = (name: string) => {
    deleteCollection(name);
    if (activeCollection === name) setActiveCollection("__all__");
    refresh();
    toast.info("Collection deleted — presets moved to Uncategorized");
  };

  const handleMovePreset = (presetId: string, collection: string) => {
    updatePreset(presetId, { collection });
    setMovingPreset(null);
    refresh();
  };

  const handleDeletePreset = (id: string) => {
    deletePreset(id);
    setConfirmDelete(null);
    refresh();
    toast.success("Preset deleted");
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  if (!mounted) return null;

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-[11px] transition-colors shadow-sm" style={{background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text-3)"}}
      >
        <span>◫</span>
        <span>Library</span>
        {presets.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-[#f0ede8] rounded text-[10px] text-[#888]">
            {presets.length}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} />

          <div style={{ position: "relative", marginLeft: "auto", width: "100%", maxWidth: "420px", height: "100vh", background: "white", borderLeft: "1px solid #e8e5e0", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.12)", overflow: "hidden" }}>

            {/* Header */}
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0" style={{borderColor:"var(--border-2)"}}>
              <div>
                <p className="font-syne font-bold text-[15px]" style={{color:"var(--text-1)"}}>Preset Library</p>
                <p className="font-mono text-[10px] mt-0.5" style={{color:"var(--text-3)"}}>{presets.length} preset{presets.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => { setOpen(false); onClose?.(); }} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{color:"var(--text-3)"}}>✕</button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ccc] text-[12px]">⌕</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search presets…"
                  className="w-full pl-8 pr-3 py-2 border border-transparent rounded-lg font-mono text-[12px] outline-none transition-colors" style={{background:"var(--surface-2)",color:"var(--text-1)"}}
                />
                {search && (
                  <button data-testid="clear-search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-[#888]">✕</button>
                )}
              </div>
            </div>

            {/* Collections tabs */}
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* All tab */}
                <button
                  onClick={() => setActiveCollection("__all__")}
                  className={`px-3 py-1 rounded-full font-mono text-[11px] transition-colors ${
                    activeCollection === "__all__"
                      ? ""
                      : ""
                  }`}
                >
                  All ({presets.length})
                </button>

                {/* Collection tabs */}
                {collectionNames.map((name) => {
                  const count = presets.filter((p) => p.collection === name).length;
                  return (
                    <div key={name} className="relative group flex items-center">
                      <button
                        onClick={() => setActiveCollection(name)}
                        className={`px-3 py-1 rounded-full font-mono text-[11px] transition-colors pr-6 ${
                          activeCollection === name
                            ? ""
                            : ""
                        }`}
                      >
                        {name} ({count})
                      </button>
                      {/* Delete collection button — only for non-default */}
                      {name !== DEFAULT_COLLECTION_NAME && (
                        <button
                          onClick={() => handleDeleteCollection(name)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                          title={`Delete collection "${name}"`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* New collection */}
                {showNewCollection ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateCollection(); if (e.key === "Escape") setShowNewCollection(false); }}
                      placeholder="Name…"
                      className="w-24 px-2 py-1 bg-white border border-[#c07040] rounded-full font-mono text-[11px] text-[#1a1a1a] outline-none"
                    />
                    <button onClick={handleCreateCollection} className="text-[#c07040] font-mono text-[11px] hover:text-[#a05030]">✓</button>
                    <button onClick={() => setShowNewCollection(false)} className="text-[#bbb] font-mono text-[11px]">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewCollection(true)}
                    className="px-3 py-1 rounded-full font-mono text-[11px] text-[#bbb] border border-dashed border-[#ddd] hover:text-[#c07040] hover:border-[#c07040] transition-colors"
                  >
                    + New
                  </button>
                )}
              </div>
            </div>

            <div className="border-t flex-shrink-0" style={{borderColor:"var(--border-2)"}} />

            {/* Preset list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: "#e8e5e0 transparent" }}>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <div className="text-4xl opacity-20">◈</div>
                  <p className="font-mono text-[11px] leading-relaxed max-w-[200px]" style={{color:"var(--text-4)"}}>
                    {search ? `No presets matching "${search}"` : "No presets in this collection yet."}
                  </p>
                </div>
              ) : (
                filtered.map((preset) => (
                  <div key={preset.id} className="flex gap-3 p-3 bg-white border border-[#f0ede8] rounded-xl hover:border-[#e8e5e0] hover:shadow-sm transition-all">
                    {/* Thumbnail */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preset.thumbnail} alt={preset.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-syne font-semibold text-[13px] truncate" style={{color:"var(--text-1)"}}>{preset.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px]" style={{color:"var(--text-4)"}}>{formatDate(preset.savedAt)}</span>
                        <span className="w-1 h-1 rounded-full bg-[#e8e5e0]" />
                        <span className="font-mono text-[10px] text-[#c07040]">{preset.collection}</span>
                      </div>
                      {preset.result.style_summary && (
                        <p className="font-mono text-[10px] mt-1 leading-relaxed line-clamp-2" style={{color:"var(--text-3)"}}>{preset.result.style_summary}</p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        <button
                          onClick={() => { onLoad(preset); setOpen(false); }}
                          className="px-2.5 py-1 font-syne font-bold text-[10px] uppercase tracking-wider rounded-md transition-colors" style={{background:"var(--text-1)",color:"var(--bg)"}}
                        >
                          Load
                        </button>

                        {/* Move to collection */}
                        {movingPreset === preset.id ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {collectionNames.filter((n) => n !== preset.collection).map((name) => (
                              <button
                                key={name}
                                onClick={() => handleMovePreset(preset.id, name)}
                                className="px-2 py-1 bg-[#f0ede8] text-[#888] font-mono text-[10px] rounded-md hover:bg-[#c07040] hover:text-white transition-colors"
                              >
                                {name}
                              </button>
                            ))}
                            <button onClick={() => setMovingPreset(null)} className="px-2 py-1 bg-[#f5f4f2] text-[#bbb] font-mono text-[10px] rounded-md">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setMovingPreset(preset.id)}
                            className="px-2.5 py-1 font-mono text-[10px] rounded-md transition-colors" style={{background:"var(--border-2)",color:"var(--text-3)"}}
                          >
                            Move
                          </button>
                        )}

                        {/* Delete */}
                        {confirmDelete === preset.id ? (
                          <div className="flex gap-1 items-center">
                            <span className="font-mono text-[10px] text-[#aaa]">Sure?</span>
                            <button onClick={() => handleDeletePreset(preset.id)} className="px-2 py-1 bg-red-50 text-red-500 font-mono text-[10px] rounded-md hover:bg-red-100 border border-red-200">Yes</button>
                            <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 bg-[#f5f4f2] text-[#aaa] font-mono text-[10px] rounded-md">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(preset.id)} className="px-2.5 py-1 font-mono text-[10px] rounded-md transition-colors" style={{background:"var(--border-2)",color:"var(--text-4)"}}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
