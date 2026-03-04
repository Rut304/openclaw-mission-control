import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const HOME = process.env.HOME || "/Users/rutroh";

interface DocCategory {
  id: string;
  label: string;
  icon: string;
  basePath: string;
  pattern?: RegExp;
  files?: string[]; // explicit file list
}

const DOC_CATEGORIES: DocCategory[] = [
  {
    id: "governance",
    label: "Governance",
    icon: "shield",
    basePath: path.join(HOME, "shared-context/governance"),
  },
  {
    id: "system",
    label: "System Docs",
    icon: "terminal",
    basePath: HOME,
    files: [
      "SYSTEM_KNOWLEDGE.md",
      "AGENTS.md",
      "MISSIONS.md",
      "ARCH.md",
      "WORKFLOWS.md",
      "MODEL_ROUTING.md",
      "AGENT_CORE_PRINCIPLES.md",
      "AGENT_MODEL_CONFIG.md",
      "AGENT_ORCHESTRATION_RULES.md",
      "AGENT_SECURITY_FIRST_RULE.md",
      "AGENT_SPECIFIC_GUIDELINES.md",
      "AGENT_TOOL_SELECTION_RULE.md",
      "BOOTSTRAP.md",
    ],
  },
  {
    id: "daily",
    label: "Daily Logs",
    icon: "calendar",
    basePath: path.join(HOME, "memory"),
    pattern: /^2026-\d{2}-\d{2}\.md$/,
  },
  {
    id: "kalshi",
    label: "Kalshi Reports",
    icon: "trending-up",
    basePath: path.join(HOME, "memory/research"),
    pattern: /kalshi/i,
  },
  {
    id: "agent-status",
    label: "Agent Status",
    icon: "bot",
    basePath: path.join(HOME, "memory/status"),
    pattern: /\.json$/,
  },
  {
    id: "strategy",
    label: "Strategy & Plans",
    icon: "rocket",
    basePath: HOME,
    files: [
      "alternative_revenue_plan.md",
      "AUTONOMOUS_REVENUE_SYSTEM.md",
      "deep_thoughts_content_plan.md",
      "blog_share_strategy.md",
      "COMPLETE_DASHBOARD_REQUIREMENTS.md",
      "AGENT_ENHANCEMENT_PLAN.md",
    ],
  },
  {
    id: "reports",
    label: "Reports & Updates",
    icon: "file-text",
    basePath: HOME,
    files: [
      "COO_ACTION_REPORT.md",
      "CEO_UPDATE_DASHBOARD_AND_POSTING.md",
      "DASHBOARD_STATUS_UPDATE.md",
      "AUTONOMOUS_STATUS_NOW.md",
      "daily_rollup_20260225.md",
      "daily_rollup_20260226.md",
      "daily_rollup_20260227.md",
    ],
  },
];

function getFilesForCategory(cat: DocCategory): { name: string; path: string; size: number; modified: string }[] {
  const results: { name: string; path: string; size: number; modified: string }[] = [];

  if (cat.files) {
    for (const f of cat.files) {
      const fp = path.join(cat.basePath, f);
      try {
        const stat = fs.statSync(fp);
        if (stat.isFile()) {
          results.push({
            name: f,
            path: fp,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        }
      } catch {
        // file doesn't exist, skip
      }
    }
  } else {
    try {
      const entries = fs.readdirSync(cat.basePath);
      for (const entry of entries) {
        if (cat.pattern && !cat.pattern.test(entry)) continue;
        const fp = path.join(cat.basePath, entry);
        try {
          const stat = fs.statSync(fp);
          if (stat.isFile()) {
            results.push({
              name: entry,
              path: fp,
              size: stat.size,
              modified: stat.mtime.toISOString(),
            });
          }
        } catch {
          // skip
        }
      }
    } catch {
      // directory doesn't exist
    }
  }

  return results.sort((a, b) => b.modified.localeCompare(a.modified));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const filePath = searchParams.get("file");

  // Return file content
  if (filePath) {
    // Security: only allow reading from known base paths
    const allowed = DOC_CATEGORIES.some(
      (cat) => filePath.startsWith(cat.basePath)
    );
    if (!allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stat = fs.statSync(filePath);
      return NextResponse.json({
        name: path.basename(filePath),
        path: filePath,
        content,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        isJson: filePath.endsWith(".json"),
      });
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  }

  // Return category listing or all categories
  if (category) {
    const cat = DOC_CATEGORIES.find((c) => c.id === category);
    if (!cat) return NextResponse.json({ error: "Unknown category" }, { status: 404 });
    return NextResponse.json({
      category: cat.id,
      label: cat.label,
      icon: cat.icon,
      files: getFilesForCategory(cat),
    });
  }

  // Return all categories with file counts
  const categories = DOC_CATEGORIES.map((cat) => {
    const files = getFilesForCategory(cat);
    return {
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      fileCount: files.length,
      latestModified: files[0]?.modified || null,
    };
  });

  return NextResponse.json({ categories });
}
