"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Pin,
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Tag,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KBEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string;
  author: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  handoff: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  system: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  agent: "bg-green-500/20 text-green-400 border-green-500/30",
  research: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  playbook: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  general: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown renderer for headers, bold, lists, code blocks
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="bg-black/40 border border-border rounded p-3 text-xs font-mono overflow-x-auto my-2"
          >
            {codeLines.join("\n")}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-xl font-bold mt-4 mb-2 text-primary">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-bold mt-3 mb-1 text-foreground">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold mt-2 mb-1 text-foreground">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 ml-4 text-sm text-muted-foreground">
          <span className="text-primary">•</span>
          <span
            dangerouslySetInnerHTML={{
              __html: line
                .slice(2)
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
                .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>'),
            }}
          />
        </div>
      );
    } else if (line.startsWith("| ")) {
      // Table row
      const cells = line.split("|").filter((c) => c.trim());
      const isHeader = lines[i + 1]?.match(/^\|[\s-|]+$/);
      elements.push(
        <div
          key={i}
          className={`grid gap-2 text-xs font-mono py-1 px-2 ${
            isHeader ? "font-bold border-b border-border" : "text-muted-foreground"
          }`}
          style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}
        >
          {cells.map((cell, ci) => (
            <span key={ci} className="truncate">
              {cell.trim()}
            </span>
          ))}
        </div>
      );
      if (isHeader) i++; // Skip separator row
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else if (line.startsWith("---")) {
      elements.push(
        <hr key={i} className="border-border my-3" />
      );
    } else {
      elements.push(
        <p
          key={i}
          className="text-sm text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
              .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>'),
          }}
        />
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

export function KnowledgeBase() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newPinned, setNewPinned] = useState(false);

  const fetchEntries = useCallback(async () => {
    const url = selectedCategory
      ? `/api/knowledge?category=${selectedCategory}`
      : "/api/knowledge";
    const res = await fetch(url);
    const data = await res.json();
    setEntries(data.entries || []);

    // Auto-expand all categories
    const cats = new Set((data.entries || []).map((e: KBEntry) => e.category));
    setExpandedCategories(cats as Set<string>);
  }, [selectedCategory]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries = entries.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  });

  const categories = [...new Set(filteredEntries.map((e) => e.category))];
  const grouped = categories.reduce(
    (acc, cat) => {
      acc[cat] = filteredEntries.filter((e) => e.category === cat);
      return acc;
    },
    {} as Record<string, KBEntry[]>
  );

  const handleCreate = async () => {
    if (!newTitle || !newContent) return;
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        category: newCategory,
        content: newContent,
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        pinned: newPinned,
        author: "rut",
      }),
    });
    setShowCreateModal(false);
    setNewTitle("");
    setNewContent("");
    setNewTags("");
    setNewPinned(false);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    if (selectedEntry?.id === id) setSelectedEntry(null);
    fetchEntries();
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 border-r border-border flex flex-col min-h-0 bg-card/30 shrink-0">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-sm tracking-wider uppercase">Knowledge Base</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <input
              className="w-full pl-8 pr-3 py-2 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <Badge
              className={`cursor-pointer text-[10px] ${
                !selectedCategory
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
              onClick={() => setSelectedCategory(null)}
            >
              All ({entries.length})
            </Badge>
            {["handoff", "system", "agent", "playbook", "research"].map((cat) => (
              <Badge
                key={cat}
                className={`cursor-pointer text-[10px] ${
                  selectedCategory === cat
                    ? CATEGORY_COLORS[cat] || CATEGORY_COLORS.general
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="p-2 space-y-1">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCategory(cat)}
                >
                  {expandedCategories.has(cat) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span className={`px-1.5 py-0.5 rounded ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.general}`}>
                    {cat}
                  </span>
                  <span className="text-[10px] text-muted-foreground">({items.length})</span>
                </button>
                {expandedCategories.has(cat) &&
                  items.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`w-full text-left px-3 py-2 ml-3 rounded text-sm transition-all ${
                        selectedEntry?.id === entry.id
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {entry.pinned ? (
                          <Pin className="w-3 h-3 text-yellow-500 shrink-0" />
                        ) : (
                          <FileText className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate font-medium">{entry.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 ml-5 text-[10px] text-muted-foreground">
                        <span>{entry.author}</span>
                        <span>·</span>
                        <span>{new Date(entry.updated_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
              </div>
            ))}
            {filteredEntries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No entries found
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedEntry ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
              <div>
                <div className="flex items-center gap-2">
                  {selectedEntry.pinned ? (
                    <Pin className="w-4 h-4 text-yellow-500" />
                  ) : null}
                  <h1 className="text-lg font-bold">{selectedEntry.title}</h1>
                  <Badge
                    className={`text-[10px] ${
                      CATEGORY_COLORS[selectedEntry.category] || CATEGORY_COLORS.general
                    }`}
                  >
                    {selectedEntry.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {selectedEntry.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedEntry.updated_at).toLocaleString()}
                  </span>
                  {JSON.parse(selectedEntry.tags || "[]").length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {JSON.parse(selectedEntry.tags).join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(selectedEntry.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1 h-0 min-h-0">
              <div className="p-6">
                <MarkdownContent content={selectedEntry.content} />
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <BookOpen className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Select an entry to view</p>
              <p className="text-xs text-muted-foreground/60">
                Or create a new one with the + button
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Knowledge Base Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Title</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Entry title..."
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Category</label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded border border-border bg-background text-sm"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="handoff">Handoff</option>
                  <option value="system">System</option>
                  <option value="agent">Agent</option>
                  <option value="playbook">Playbook</option>
                  <option value="research">Research</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Tags (comma separated)</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded border border-border bg-background text-sm"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="rip, n8n, workflows..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newPinned}
                onChange={(e) => setNewPinned(e.target.checked)}
                className="rounded"
              />
              <label className="text-sm">Pin to top</label>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">
                Content (Markdown)
              </label>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded border border-border bg-background text-sm font-mono min-h-[300px] focus:outline-none focus:ring-1 focus:ring-primary"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write markdown content..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newTitle || !newContent}>
              <Save className="w-4 h-4 mr-1" />
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
