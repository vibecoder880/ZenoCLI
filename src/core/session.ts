/**
 * Session persistence — save/resume/fork conversations as JSONL files.
 *
 * Sessions are stored at ~/.zenocli/projects/{hash}/sessions/{id}.jsonl
 */

import { existsSync, readdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getSessionsDirectory } from "../storage/paths.js";

// ---- Types ----

export interface SessionEntry {
  type: "system" | "user" | "assistant" | "tool_use" | "tool_result" | "compact";
  content: string;
  tokens?: number;
  tool?: string;
  input?: Record<string, unknown>;
  timestamp: string;
}

export interface SessionMeta {
  id: string;
  cwd: string;
  gitBranch?: string;
  model: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
}

// ---- Helpers ----

function generateSessionId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(4).toString("hex");
  return `${dateStr}-${rand}`;
}

function entryToLine(entry: SessionEntry): string {
  return JSON.stringify(entry) + "\n";
}

function lineToEntry(line: string): SessionEntry | null {
  try {
    return JSON.parse(line.trim()) as SessionEntry;
  } catch {
    return null;
  }
}

function getMetaPath(sessionsDir: string, sessionId: string): string {
  return path.join(sessionsDir, `${sessionId}.meta.json`);
}

// ---- SessionWriter ----

export class SessionWriter {
  readonly id: string;
  private readonly dataPath: string;
  private readonly metaPath: string;
  private readonly meta: SessionMeta;
  private entryCount = 0;

  constructor(cwd: string, model: string, provider: string, existingId?: string) {
    this.id = existingId ?? generateSessionId();
    const sessionsDir = getSessionsDirectory(cwd);
    this.dataPath = path.join(sessionsDir, `${this.id}.jsonl`);
    this.metaPath = getMetaPath(sessionsDir, this.id);

    const now = new Date().toISOString();
    this.meta = {
      id: this.id,
      cwd,
      model,
      provider,
      createdAt: now,
      updatedAt: now,
      entryCount: 0,
    };

    // Write initial meta
    writeFileSync(this.metaPath, JSON.stringify(this.meta, null, 2), "utf8");
  }

  /** Append an entry to the session file. */
  append(entry: SessionEntry): void {
    appendFileSync(this.dataPath, entryToLine(entry), "utf8");
    this.entryCount++;
    this.meta.entryCount = this.entryCount;
    this.meta.updatedAt = new Date().toISOString();
    // Update meta file periodically (every 5 entries to reduce I/O)
    if (this.entryCount % 5 === 0) {
      writeFileSync(this.metaPath, JSON.stringify(this.meta, null, 2), "utf8");
    }
  }

  /** Flush final meta on close. */
  close(): void {
    writeFileSync(this.metaPath, JSON.stringify(this.meta, null, 2), "utf8");
  }

  get dataFilePath(): string {
    return this.dataPath;
  }
}

// ---- SessionReader ----

export class SessionReader {
  private readonly entries: SessionEntry[] = [];
  readonly meta: SessionMeta;

  constructor(sessionId: string, cwd: string) {
    const sessionsDir = getSessionsDirectory(cwd);
    const dataPath = path.join(sessionsDir, `${sessionId}.jsonl`);
    const metaPath = getMetaPath(sessionsDir, sessionId);

    if (!existsSync(dataPath)) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    // Read meta
    this.meta = existsSync(metaPath)
      ? JSON.parse(readFileSync(metaPath, "utf8")) as SessionMeta
      : {
          id: sessionId,
          cwd,
          createdAt: "",
          updatedAt: "",
          model: "",
          provider: "",
          entryCount: 0,
        };

    // Read entries
    const lines = readFileSync(dataPath, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      const entry = lineToEntry(line);
      if (entry) {
        this.entries.push(entry);
      }
    }
  }

  /** Get all entries. */
  getEntries(): SessionEntry[] {
    return [...this.entries];
  }

  /** Get entries of a specific type. */
  getEntriesByType(type: SessionEntry["type"]): SessionEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  /** Get conversation messages (user + assistant only). */
  getConversationMessages(): Array<{ role: "user" | "assistant"; content: string }> {
    return this.entries
      .filter((e) => e.type === "user" || e.type === "assistant")
      .map((e) => ({
        role: e.type as "user" | "assistant",
        content: e.content,
      }));
  }
}

// ---- Session Management ----

/** List all sessions for a project, sorted by most recent first. */
export function listSessions(cwd: string): SessionMeta[] {
  const sessionsDir = getSessionsDirectory(cwd);
  if (!existsSync(sessionsDir)) {
    return [];
  }

  const files = readdirSync(sessionsDir);
  const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

  const metas: SessionMeta[] = [];
  for (const file of metaFiles) {
    try {
      const meta = JSON.parse(readFileSync(path.join(sessionsDir, file), "utf8")) as SessionMeta;
      metas.push(meta);
    } catch {
      // Skip corrupted meta files
    }
  }

  return metas.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Get the most recent session ID for a project. */
export function getLatestSessionId(cwd: string): string | undefined {
  const sessions = listSessions(cwd);
  return sessions.length > 0 ? sessions[0].id : undefined;
}

/** Fork a session: copy all entries to a new session file with a new ID. */
/**
 * Fork a session to a new writer. When `upToIndex` is given, only entries up to
 * (and excluding) that index are carried — forking "from a message".
 */
export function forkSession(sessionId: string, cwd: string, upToIndex?: number): SessionWriter {
  const reader = new SessionReader(sessionId, cwd);
  const writer = new SessionWriter(reader.meta.cwd, reader.meta.model, reader.meta.provider);

  const entries = reader.getEntries();
  const slice = upToIndex === undefined ? entries : entries.slice(0, upToIndex);
  for (const entry of slice) {
    writer.append(entry);
  }
  writer.close();

  return writer;
}

/** Delete a session file and its meta. */
export function deleteSession(sessionId: string, cwd: string): void {
  const sessionsDir = getSessionsDirectory(cwd);
  const dataPath = path.join(sessionsDir, `${sessionId}.jsonl`);
  const metaPath = getMetaPath(sessionsDir, sessionId);

  if (existsSync(dataPath)) {
    writeFileSync(dataPath, "", "utf8"); // truncate
  }
  if (existsSync(metaPath)) {
    writeFileSync(metaPath, "", "utf8"); // truncate
  }
}
