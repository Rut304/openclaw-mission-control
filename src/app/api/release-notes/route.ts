import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const NOTES_DIR = path.join(process.env.HOME || "/Users/rutroh", "shared-context", "release-notes");
const NOTES_FILE = path.join(NOTES_DIR, "notes.json");

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

async function ensureFile(): Promise<ReleaseNote[]> {
  if (!existsSync(NOTES_DIR)) {
    await mkdir(NOTES_DIR, { recursive: true });
  }
  if (!existsSync(NOTES_FILE)) {
    const seed: ReleaseNote[] = [
      {
        id: "rn-20260303-1",
        version: "2026.3.3",
        title: "Mission Control Major UI Overhaul",
        date: "2026-03-03",
        author: "Reg + Rex",
        category: "feature",
        items: [
          "Expanded sidebar navigation with labeled sections (COMMAND, OPERATIONS, BUSINESS, SYSTEM)",
          "CEO Dashboard rewrite with priority board, agent stats, sparkline charts, social cards",
          "New /api/ceo-board endpoint for priority management with full CRUD",
          "Agent Office enriched with 5 new data functions and 4-tab detail panel",
          "CronJobCard component for schedule management",
          "Model extraction bug fix for agent status display"
        ],
        highlights: "Complete nav + CEO dashboard redesign — from icon-only sidebar to full labeled navigation with 4 grouped sections"
      },
      {
        id: "rn-20260303-2",
        version: "2026.3.3",
        title: "Agent Team Expansion & Refinement",
        date: "2026-03-03",
        author: "Rip + Rex",
        category: "feature",
        items: [
          "Created Riz (Video Production Lead) — owns entire video pipeline from script to upload",
          "Created Rox (Head of Security / CISO) — twice-daily intel collection, 4 security domains",
          "Upgraded Rio to Gemini 2.5 Flash — full Personal Assistant with email, Telegram, calendar, family duties",
          "Added per-agent tool restrictions — specialists get role-specific tools only",
          "Added leadership & delegation tools to all 4 exec agents (Rip, Rex, Red, Rio)",
          "Riz: social media monitoring every 4h + continuous improvement authority",
          "Rox: X/Twitter + Reddit security intel feeds, restricted to security-only tools",
          "Rak: restricted to trading-only tools with explicit NEVER USE list"
        ],
        highlights: "11 agents now with properly scoped tool access — execs get leadership tools, specialists get domain tools"
      },
      {
        id: "rn-20260302-1",
        version: "2026.3.2",
        title: "Video QA System & Session Persistence",
        date: "2026-03-02",
        author: "Reg",
        category: "feature",
        items: [
          "Built complete video_qa.py quality assurance system for automated video validation",
          "Fixed session persistence across agent restarts",
          "Fixed Chinese language response bug — agents now respond in English",
          "Implemented seamless agent rotation protocol"
        ],
        highlights: "13/13 verification checks passed — rock solid video pipeline"
      },
      {
        id: "rn-20260301-1",
        version: "2026.3.1",
        title: "Infrastructure & Security Hardening",
        date: "2026-03-01",
        author: "Rex + Reg",
        category: "security",
        items: [
          "ClawJacked vulnerability assessment completed",
          "Agent registry centralized at agent-registry.json",
          "Cron job system with 32 scheduled tasks",
          "Agent tool audit — 38 tools per agent catalogued"
        ],
        highlights: "Full security audit and infrastructure hardening pass"
      }
    ];
    await writeFile(NOTES_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const raw = await readFile(NOTES_FILE, "utf-8");
  return JSON.parse(raw);
}

export async function GET() {
  try {
    const notes = await ensureFile();
    return NextResponse.json({ notes: notes.sort((a, b) => b.date.localeCompare(a.date)) });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const notes = await ensureFile();
    const newNote: ReleaseNote = {
      id: `rn-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${notes.length + 1}`,
      version: body.version || new Date().toISOString().slice(0, 10).replace(/-/g, "."),
      title: body.title || "Untitled Release",
      date: body.date || new Date().toISOString().slice(0, 10),
      author: body.author || "System",
      category: body.category || "improvement",
      items: body.items || [],
      highlights: body.highlights || undefined,
    };
    notes.unshift(newNote);
    await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
    return NextResponse.json({ note: newNote });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const notes = await ensureFile();
    const filtered = notes.filter((n) => n.id !== id);
    await writeFile(NOTES_FILE, JSON.stringify(filtered, null, 2));
    return NextResponse.json({ deleted: id });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
