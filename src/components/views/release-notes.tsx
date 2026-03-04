"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tag,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  Shield,
  Wrench,
  Bug,
  Zap,
  X,
} from "lucide-react";

interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  date: string;
  author: string;
  category: "feature" | "bugfix" | "improvement" | "security" | "infrastructure";
  items: string[];
  highlights?: string;
}

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof Tag; color: string; bg: string; label: string }
> = {
  feature: { icon: Sparkles, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Feature" },
  bugfix: { icon: Bug, color: "text-red-400", bg: "bg-red-500/10", label: "Bug Fix" },
  improvement: { icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10", label: "Improvement" },
  security: { icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10", label: "Security" },
  infrastructure: { icon: Wrench, color: "text-purple-400", bg: "bg-purple-500/10", label: "Infrastructure" },
};

export function ReleaseNotes() {
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [newNote, setNewNote] = useState({
    version: "",
    title: "",
    author: "",
    category: "feature" as ReleaseNote["category"],
    items: "",
    highlights: "",
  });

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/release-notes");
      const data = await res.json();
      setNotes(data.notes || []);
      // Auto-expand first note
      if (data.notes?.length > 0 && expanded.size === 0) {
        setExpanded(new Set([data.notes[0].id]));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newNote.title || !newNote.items) return;
    await fetch("/api/release-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newNote,
        items: newNote.items.split("\n").filter((l) => l.trim()),
      }),
    });
    setNewNote({ version: "", title: "", author: "", category: "feature", items: "", highlights: "" });
    setShowForm(false);
    fetchNotes();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/release-notes?id=${id}`, { method: "DELETE" });
    fetchNotes();
  };

  // Group by date
  const grouped = notes.reduce<Record<string, ReleaseNote[]>>((acc, note) => {
    const key = note.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            Release Notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            RutRoh Inc — System changelog & deployment history
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-medium"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "New Release"}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const count = notes.filter((n) => n.category === key).length;
          const Icon = cfg.icon;
          return (
            <div key={key} className={`rounded-lg p-3 ${cfg.bg} border border-border/50`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className="text-xs font-medium text-muted-foreground">{cfg.label}</span>
              </div>
              <p className="text-xl font-bold mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* New Release Form */}
      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Create Release Note</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={newNote.version}
              onChange={(e) => setNewNote({ ...newNote, version: e.target.value })}
              placeholder="Version (e.g. 2026.3.4)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              placeholder="Release title *"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={newNote.author}
              onChange={(e) => setNewNote({ ...newNote, author: e.target.value })}
              placeholder="Author (e.g. Reg + Rex)"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={newNote.category}
              onChange={(e) =>
                setNewNote({ ...newNote, category: e.target.value as ReleaseNote["category"] })
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={newNote.items}
            onChange={(e) => setNewNote({ ...newNote, items: e.target.value })}
            placeholder="Items (one per line) *"
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={newNote.highlights}
            onChange={(e) => setNewNote({ ...newNote, highlights: e.target.value })}
            placeholder="Highlight summary (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!newNote.title || !newNote.items}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
          >
            Publish Release Note
          </button>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([date, dateNotes]) => (
          <div key={date}>
            {/* Date Header */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Notes for this date */}
            <div className="space-y-3 ml-2 border-l-2 border-border pl-4">
              {dateNotes.map((note) => {
                const cfg = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.improvement;
                const Icon = cfg.icon;
                const isOpen = expanded.has(note.id);

                return (
                  <div
                    key={note.id}
                    className="rounded-xl border border-border bg-card hover:border-border/80 transition"
                  >
                    {/* Note Header */}
                    <button
                      onClick={() => toggleExpanded(note.id)}
                      className="w-full flex items-center gap-3 p-4 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className={`shrink-0 rounded-md p-1.5 ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{note.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            v{note.version}
                          </span>
                        </div>
                        {note.highlights && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {note.highlights}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          {note.author}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {note.items.length} item{note.items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-0 border-t border-border/50">
                        <ul className="space-y-1.5 mt-3">
                          {note.items.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.color.replace("text-", "bg-")}`} />
                              {item}
                            </li>
                          ))}
                        </ul>
                        <div className="flex justify-end mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(note.id);
                            }}
                            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {notes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No release notes yet</p>
          <p className="text-sm">Click &ldquo;New Release&rdquo; to create the first one</p>
        </div>
      )}
    </div>
  );
}
