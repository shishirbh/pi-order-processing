#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

import {
  createAgentSession,
  SessionManager,
  DefaultResourceLoader,
  getAgentDir,
} from "@mariozechner/pi-coding-agent";

// ── Config ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_URL = "https://github.com/shishirbh/order-processing.git";
const INSTALL_DIR = join(homedir(), ".pi-order-processing");
const REPO_DIR = join(INSTALL_DIR, "order-processing");
const SESSIONS_DIR = join(INSTALL_DIR, "sessions");
const PUBLIC_DIR = join(__dirname, "..", "public");
const PORT = 0; // auto-assign

// ── Step 1: Clone or update the knowledge base repo ─────────────────
if (!existsSync(REPO_DIR)) {
  console.log("\n📦 First run — cloning order-processing knowledge base...\n");
  execSync(`git clone "${REPO_URL}" "${REPO_DIR}"`, { stdio: "inherit" });
} else {
  console.log("\n🔄 Pulling latest order-processing knowledge base...\n");
  try {
    execSync("git pull --rebase", { cwd: REPO_DIR, stdio: "inherit" });
  } catch {
    console.log("  (pull failed — using cached copy)");
  }
}

console.log(`   Knowledge base: ${REPO_DIR}`);
console.log(`   Skills: ${join(REPO_DIR, "plugin", "skills")}\n`);

// Ensure sessions directory
if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function serveStatic(res, path) {
  try {
    const file = readFileSync(path);
    const ext = path.split(".").pop();
    const types = { html: "text/html", css: "text/css", js: "application/javascript", png: "image/png", svg: "image/svg+xml" };
    res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ── Session file I/O ────────────────────────────────────────────────
function sessionFile(id) {
  return join(SESSIONS_DIR, `${id.replace(/[<>:"/\\|?*]/g, "_")}.json`);
}

function saveSession(id, messages) {
  writeFileSync(sessionFile(id), JSON.stringify(messages));
}

function loadSession(id) {
  const f = sessionFile(id);
  if (!existsSync(f)) return [];
  try { return JSON.parse(readFileSync(f, "utf-8")); } catch { return []; }
}

function deleteSessionFile(id) {
  const f = sessionFile(id);
  if (existsSync(f)) unlinkSync(f);
}

function listSessionFiles() {
  try {
    return readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        id: f.replace(".json", ""),
        name: f.replace(".json", "").replace(/_/g, " ").slice(0, 40),
        path: f.replace(".json", ""),
      }));
  } catch {
    return [];
  }
}

// ── Skills loader ───────────────────────────────────────────────────
const SKILLS_DIR = join(REPO_DIR, "plugin", "skills");

function loadSkillsFromDir() {
  if (!existsSync(SKILLS_DIR)) return [];
  try {
    return readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const mdPath = join(SKILLS_DIR, d.name, "SKILL.md");
        if (!existsSync(mdPath)) return null;
        const content = readFileSync(mdPath, "utf-8");
        const fm = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fm) return null;
        return {
          name: fm[1].match(/name:\s*(.+)/)?.[1]?.trim() || d.name,
          description: fm[1].match(/description:\s*(.+)/)?.[1]?.trim() || "",
          filePath: mdPath,
          baseDir: join(SKILLS_DIR, d.name),
          source: "project",
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Create agent session ────────────────────────────────────────────
const activeSessions = new Map();

async function createAgent() {
  const customSkills = loadSkillsFromDir();

  const loader = new DefaultResourceLoader({
    cwd: REPO_DIR,
    agentDir: getAgentDir(),
    skillsOverride: (current) => ({
      skills: [...current.skills, ...customSkills],
      diagnostics: current.diagnostics,
    }),
  });
  await loader.reload();

  const { session } = await createAgentSession({
    cwd: REPO_DIR,
    sessionManager: SessionManager.inMemory(),
    resourceLoader: loader,
  });
  return session;
}

// ── Server ──────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // Static
  if (req.method === "GET" && path === "/") return serveStatic(res, join(PUBLIC_DIR, "index.html"));

  // List sessions
  if (req.method === "GET" && path === "/api/sessions") return json(res, listSessionFiles());

  // Create session
  if (req.method === "POST" && path === "/api/sessions") {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    saveSession(id, []);
    return json(res, { id, name: "New conversation" });
  }

  // Get messages
  if (req.method === "GET" && path.startsWith("/api/sessions/") && path.endsWith("/messages")) {
    const id = decodeURIComponent(path.split("/api/sessions/")[1].replace("/messages", ""));
    const msgs = activeSessions.has(id)
      ? activeSessions.get(id).session.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }))
      : loadSession(id);
    return json(res, msgs);
  }

  // Delete session
  if (req.method === "DELETE" && path.startsWith("/api/sessions/")) {
    const id = decodeURIComponent(path.split("/api/sessions/")[1]);
    deleteSessionFile(id);
    if (activeSessions.has(id)) activeSessions.delete(id);
    return json(res, { ok: true });
  }

  // Send prompt (SSE stream)
  if (req.method === "POST" && path.startsWith("/api/sessions/") && path.endsWith("/prompt")) {
    const sessionId = decodeURIComponent(path.split("/api/sessions/")[1].replace("/prompt", ""));

    let body = "";
    for await (const chunk of req) body += chunk;
    let prompt;
    try { prompt = JSON.parse(body).prompt; } catch { return json(res, { error: "Invalid JSON" }, 400); }
    if (!prompt) return json(res, { error: "Missing prompt" }, 400);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      const session = await createAgent();
      activeSessions.set(sessionId, { session });

      const unsub = session.subscribe((event) => {
        if (event.type === "message_update") {
          const me = event.assistantMessageEvent;
          if (me.type === "text_delta") {
            res.write(`data: ${JSON.stringify({ type: "text", delta: me.delta })}\n\n`);
          } else if (me.type === "thinking_delta") {
            res.write(`data: ${JSON.stringify({ type: "thinking", delta: me.delta })}\n\n`);
          }
        } else if (event.type === "tool_execution_start") {
          res.write(`data: ${JSON.stringify({ type: "tool_start", tool: event.toolName })}\n\n`);
        } else if (event.type === "tool_execution_end") {
          res.write(`data: ${JSON.stringify({ type: "tool_end", tool: event.toolName })}\n\n`);
        } else if (event.type === "agent_end") {
          const msgs = session.messages.map((m) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          }));
          saveSession(sessionId, msgs);
          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        }
      });

      await session.prompt(prompt);
      unsub();
    } catch (e) {
      console.error("Prompt error:", e.message);
      res.write(`data: ${JSON.stringify({ type: "error", error: e.message })}\n\n`);
    }
    res.end();
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  const addr = server.address();
  const actualPort = addr.port;
  const url = `http://localhost:${actualPort}`;
  console.log(`\n🚀 DK Hardware Order Processing ready!`);
  console.log(`   ===> Open ${url} in your browser <===\n`);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    process.exit(1);
  }
  throw e;
});
