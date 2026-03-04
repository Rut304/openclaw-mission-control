"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Shield,
  Terminal,
  Calendar,
  TrendingUp,
  Bot,
  Rocket,
  RefreshCw,
  ArrowLeft,
  Clock,
  Search,
  Copy,
  Check,
  ChevronRight,
  FolderOpen,
} from "lucide-react";

interface DocCategory {
  id: string;
  label: string;
  icon: string;
  fileCount: number;
  latestModified: string | null;
}

interface DocFile {
  name: string;
  path: string;
  size: number;
  modified: string;
}

interface DocContent {
  name: string;
  path: string;
  content: string;
  size: number;
  modified: string;
  isJson: boolean;
}

const ICON_MAP: Record<string, typeof FileText> = {
  shield: Shield,
  terminal: Terminal,
  calendar: Calendar,
  "trending-up": TrendingUp,
  bot: Bot,
  rocket: Rocket,
  "file-text": FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  governance: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  system: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  daily: "text-green-400 bg-green-400/10 border-green-400/20",
  kalshi: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  "agent-status": "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  strategy: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  reports: "text-red-400 bg-red-400/10 border-red-400/20",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Simple markdown renderer — handles headers, bold, code blocks, lists, links
function renderMarkdown(content: string): string {
  let html = content
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/30 border border-border rounded-lg p-4 my-3 overflow-x-auto text-xs font-mono"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono text-primary">$1</code>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4 class="text-sm font-bold text-foreground mt-4 mb-1">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-foreground mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-foreground mt-6 mb-2 pb-1 border-b border-border">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-foreground mt-6 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-primary underline hover:text-primary/80">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-muted-foreground">$1</li>')
    .replace(/^  - (.+)$/gm, '<li class="ml-8 list-disc text-muted-foreground text-xs">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-muted-foreground">$1</li>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="border-border my-4" />')
    // Tables (basic)
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split("|").filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return ""; // separator row
      const tag = "td";
      return `<tr>${cells.map((c) => `<${tag} class="border border-border px-2 py-1 text-xs">${c}</${tag}>`).join("")}</tr>`;
    })
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p class="text-muted-foreground text-sm leading-relaxed my-2">');

  return `<p class="text-muted-foreground text-sm leading-relaxed">${html}</p>`;
}

export function DocsView() {
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [files, setFiles] = useState<DocFile[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string>("");
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/docs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCategories(json.categories);
    } catch (e) {
      console.error("Failed to fetch docs categories:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFiles = useCallback(async (categoryId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/docs?category=${categoryId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setFiles(json.files);
      setActiveCategory(categoryId);
      setActiveCategoryLabel(json.label);
    } catch (e) {
      console.error("Failed to fetch files:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDoc = useCallback(async (filePath: string) => {
    try {
      setLoadingFile(true);
      const res = await fetch(`/api/docs?file=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDoc(json);
    } catch (e) {
      console.error("Failed to fetch doc:", e);
    } finally {
      setLoadingFile(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleBack = () => {
    if (doc) {
      setDoc(null);
    } else if (activeCategory) {
      setActiveCategory(null);
      setFiles([]);
    }
  };

  const handleCopy = () => {
    if (doc) {
      navigator.clipboard.writeText(doc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCategories = categories.filter((c) =>
    c.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Document viewer
  if (doc) {
    return (
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold">{doc.name}</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(doc.modified)}
                </span>
                <span>{formatBytes(doc.size)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-xs"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Content */}
        <div className="bg-card/50 border border-border rounded-xl p-6 max-w-4xl">
          {doc.isJson ? (
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(JSON.parse(doc.content), null, 2)}
            </pre>
          ) : (
            <div
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
            />
          )}
        </div>
      </div>
    );
  }

  // File listing for a category
  if (activeCategory) {
    return (
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold">{activeCategoryLabel}</h2>
              <span className="text-xs text-muted-foreground">{filteredFiles.length} documents</span>
            </div>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-sm w-64 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* File list */}
        <div className="space-y-2">
          {filteredFiles.map((file) => (
            <button
              key={file.path}
              onClick={() => fetchDoc(file.path)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-accent/50 transition-colors text-left group"
            >
              <div className={`p-2 rounded-lg ${CATEGORY_COLORS[activeCategory] || "text-muted-foreground bg-muted/10 border-border"} border`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{file.name}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(file.modified)}
                  </span>
                  <span>{formatBytes(file.size)}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          ))}
          {filteredFiles.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No documents found</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Category grid (home)
  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Documentation Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Governance docs, daily logs, Kalshi reports, agent status, and system documentation
          </p>
        </div>
        <button
          onClick={fetchCategories}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-xs"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-sm w-full max-w-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const IconComponent = ICON_MAP[cat.icon] || FileText;
            const colors = CATEGORY_COLORS[cat.id] || "text-muted-foreground bg-muted/10 border-border";
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSearchQuery("");
                  fetchFiles(cat.id);
                }}
                className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card/50 hover:bg-accent/50 transition-all hover:shadow-lg hover:shadow-primary/5 text-left group"
              >
                <div className={`p-3 rounded-xl ${colors} border`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm group-hover:text-primary transition-colors">{cat.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {cat.fileCount} document{cat.fileCount !== 1 ? "s" : ""}
                  </div>
                  {cat.latestModified && (
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {timeAgo(cat.latestModified)}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors mt-1" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
