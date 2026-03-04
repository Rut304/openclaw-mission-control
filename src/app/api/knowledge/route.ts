import { NextResponse } from "next/server";
import {
  listKBEntries,
  getKBEntry,
  createKBEntry,
  updateKBEntry,
  deleteKBEntry,
} from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;
  const id = searchParams.get("id");

  if (id) {
    const entry = getKBEntry(id);
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(entry);
  }

  const entries = listKBEntries(category);
  return NextResponse.json({ entries, count: entries.length });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, category, content, tags, author, pinned } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }

  const entry = createKBEntry({
    id: randomUUID(),
    title,
    category,
    content,
    tags,
    author,
    pinned,
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, ...patch } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const entry = updateKBEntry(id, patch);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id param required" }, { status: 400 });
  }

  deleteKBEntry(id);
  return NextResponse.json({ deleted: true });
}
