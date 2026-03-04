import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PRIORITIES_PATH = path.join(
  process.env.HOME || "/Users/rutroh",
  "shared-context",
  "ceo-priorities.json"
);

interface Priority {
  id: string;
  text: string;
  setBy: string;
  overriddenBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PrioritiesFile {
  priorities: Priority[];
  lastUpdated: string;
}

function readPriorities(): PrioritiesFile {
  try {
    if (!fs.existsSync(PRIORITIES_PATH)) {
      return { priorities: [], lastUpdated: new Date().toISOString() };
    }
    const raw = fs.readFileSync(PRIORITIES_PATH, "utf-8");
    return JSON.parse(raw) as PrioritiesFile;
  } catch {
    return { priorities: [], lastUpdated: new Date().toISOString() };
  }
}

function writePriorities(data: PrioritiesFile): void {
  const dir = path.dirname(PRIORITIES_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PRIORITIES_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function generateId(): string {
  return `p${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET() {
  try {
    const data = readPriorities();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read priorities", detail: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, setBy } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing required field: text (string)" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newPriority: Priority = {
      id: generateId(),
      text,
      setBy: setBy || "rut",
      overriddenBy: null,
      createdAt: now,
      updatedAt: now,
    };

    const data = readPriorities();
    data.priorities.push(newPriority);
    data.lastUpdated = now;
    writePriorities(data);

    return NextResponse.json(newPriority, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to add priority", detail: message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, text, overriddenBy } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing required field: id (string)" },
        { status: 400 }
      );
    }

    const data = readPriorities();
    const idx = data.priorities.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json(
        { error: `Priority not found: ${id}` },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    if (text !== undefined) data.priorities[idx].text = text;
    if (overriddenBy !== undefined)
      data.priorities[idx].overriddenBy = overriddenBy;
    data.priorities[idx].updatedAt = now;
    data.lastUpdated = now;
    writePriorities(data);

    return NextResponse.json(data.priorities[idx]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update priority", detail: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing required field: id (string)" },
        { status: 400 }
      );
    }

    const data = readPriorities();
    const idx = data.priorities.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json(
        { error: `Priority not found: ${id}` },
        { status: 404 }
      );
    }

    const removed = data.priorities.splice(idx, 1)[0];
    data.lastUpdated = new Date().toISOString();
    writePriorities(data);

    return NextResponse.json({ deleted: removed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete priority", detail: message },
      { status: 500 }
    );
  }
}
