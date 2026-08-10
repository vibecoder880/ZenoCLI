/**
 * Task List — file-based task coordination cho teams.
 *
 * Tasks stored as JSONL tại ~/.zenocli/teams/{name}/tasks.jsonl
 * Hỗ trợ dependencies (blocks/blockedBy), claim bằng file lock.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, openSync, closeSync, unlinkSync } from "node:fs";
import crypto from "node:crypto";
import { getTaskListPath, getTeamDirectory } from "../storage/paths.js";

// ---- Types ----

export type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

export interface Task {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  owner?: string;
  /** Task IDs mà task này blocks (phụ thuộc vào nó). */
  blocks?: string[];
  /** Task IDs blocking task này (phải xong trước). */
  blockedBy?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreateInput {
  subject: string;
  description: string;
  blocks?: string[];
  blockedBy?: string[];
}

// ---- Helpers ----

function generateTaskId(): string {
  return `task_${crypto.randomBytes(4).toString("hex")}`;
}

function taskToLine(task: Task): string {
  return JSON.stringify(task) + "\n";
}

function lineToTask(line: string): Task | null {
  try {
    return JSON.parse(line.trim()) as Task;
  } catch {
    return null;
  }
}

// ---- File Lock (atomic exclusive create) ----

const LOCK_TIMEOUT = 5000;
/** Minimum delay between lock acquisition attempts (ms). */
const LOCK_RETRY_DELAY = 25;

/** Block the current thread briefly without a CPU-burning spin. */
function sleepSync(ms: number): void {
  const buffer = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(buffer, 0, 0, ms);
}

interface LockToken {
  pid: number;
  createdAt: number;
}

function serializeToken(token: LockToken): string {
  return `${token.pid}:${token.createdAt}`;
}

function parseToken(content: string): LockToken | null {
  const match = content.trim().match(/^(\d+):(\d+)$/);
  if (!match) {
    return null;
  }
  return { pid: Number(match[1]), createdAt: Number(match[2]) };
}

/**
 * Serialize a mutation under an inter-process lock.
 *
 * The lock file is created with `openSync(..., "wx")` which fails with
 * EEXIST when another process holds it — an atomic compare-and-set on the
 * filesystem, so two processes can never both believe they hold the lock.
 * A stale lock (owner PID no longer alive, or older than LOCK_TIMEOUT) is
 * reclaimed. Between attempts the thread sleeps via Atomics.wait instead of
 * busy-spinning.
 */
function withLock(filePath: string, fn: () => void): void {
  const lockPath = filePath + ".lock";
  const start = Date.now();
  const myToken: LockToken = { pid: process.pid, createdAt: Date.now() };

  let acquired = false;
  while (!acquired && Date.now() - start < LOCK_TIMEOUT) {
    try {
      const fd = openSync(lockPath, "wx");
      // We own the new lock file.
      writeFileSync(lockPath, serializeToken(myToken), "utf8");
      closeSync(fd);
      acquired = true;
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw err;
      }

      // Someone else holds it — reclaim if stale.
      try {
        const content = readFileSync(lockPath, "utf8").trim();
        const token = parseToken(content);
        const staleByAge = !token || Date.now() - token.createdAt > LOCK_TIMEOUT;
        const staleByPid = token ? !isProcessAlive(token.pid) : false;

        if (staleByAge || staleByPid) {
          try {
            unlinkSync(lockPath);
          } catch {
            // The owner may have released between read and here; that is fine.
          }
        }
      } catch {
        // Lock released between read and reclaim — retry.
      }

      sleepSync(LOCK_RETRY_DELAY);
    }
  }

  if (!acquired) {
    throw new Error(`Lock timeout: ${lockPath}`);
  }

  try {
    fn();
  } finally {
    try {
      unlinkSync(lockPath); // release — remove so the next acquire sees no file
    } catch {
      // Another process may have already reclaimed it; ignore.
    }
  }
}

/** Cheap cross-platform liveness probe: does a process with this PID exist? */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH: no such process. EPERM: exists but not ours to signal.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

// ---- TaskList class ----

export class TaskList {
  private readonly filePath: string;
  private readonly teamName: string;
  private cache: Task[] | null = null;

  constructor(teamName: string) {
    this.teamName = teamName;
    this.filePath = getTaskListPath(teamName);
  }

  /** Đọc tất cả tasks từ file. */
  loadAll(): Task[] {
    if (this.cache) return [...this.cache];

    if (!existsSync(this.filePath)) {
      return [];
    }

    const content = readFileSync(this.filePath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    const tasks: Task[] = [];

    for (const line of lines) {
      const task = lineToTask(line);
      if (task && task.status !== "deleted") {
        tasks.push(task);
      }
    }

    this.cache = tasks;
    return tasks;
  }

  /** Tạo task mới. */
  create(input: TaskCreateInput): Task {
    const task: Task = {
      id: generateTaskId(),
      subject: input.subject,
      description: input.description,
      status: "pending",
      blocks: input.blocks,
      blockedBy: input.blockedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    withLock(this.filePath, () => {
      appendFileSync(this.filePath, taskToLine(task), "utf8");
    });
    this.cache = null;

    return task;
  }

  /** Update task theo ID. */
  update(id: string, updates: Partial<Task>): Task | null {
    const tasks = this.loadAll();
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;

    const updated = { ...task, ...updates, updatedAt: new Date().toISOString() };
    this.writeAll(tasks.map((t) => (t.id === id ? updated : t)));
    this.cache = null;
    return updated;
  }

  /** Claim task (đánh dấu in_progress và set owner). */
  claim(id: string, owner: string): Task | null {
    return this.update(id, { status: "in_progress", owner });
  }

  /** Complete task. */
  complete(id: string): Task | null {
    return this.update(id, { status: "completed" });
  }

  /** Delete task (soft delete). */
  delete(id: string): Task | null {
    return this.update(id, { status: "deleted" });
  }

  /** Lấy task theo ID. */
  get(id: string): Task | undefined {
    return this.loadAll().find((t) => t.id === id);
  }

  /** Lấy tasks theo status. */
  getByStatus(status: TaskStatus): Task[] {
    return this.loadAll().filter((t) => t.status === status);
  }

  /** Lấy tasks của một owner. */
  getByOwner(owner: string): Task[] {
    return this.loadAll().filter((t) => t.owner === owner);
  }

  /** Lấy tasks unblocked (không có blockedBy nào đang pending/in_progress). */
  getUnblocked(): Task[] {
    const all = this.loadAll();
    const incomplete = new Set(
      all
        .filter((t) => t.status === "pending" || t.status === "in_progress")
        .map((t) => t.id),
    );

    return all.filter((t) => {
      if (t.status !== "pending") return false;
      if (!t.blockedBy || t.blockedBy.length === 0) return true;
      return t.blockedBy.every((id) => !incomplete.has(id));
    });
  }

  /** Lấy task theo ID nếu task đang unblocked. */
  canClaim(id: string): boolean {
    const task = this.get(id);
    if (!task || task.status !== "pending") return false;
    if (!task.blockedBy || task.blockedBy.length === 0) return true;
    const all = this.loadAll();
    return task.blockedBy.every((depId) => {
      const dep = all.find((t) => t.id === depId);
      return dep?.status === "completed";
    });
  }

  /** Invalidate cache (force reload). */
  invalidate(): void {
    this.cache = null;
  }

  /** Ghi lại toàn bộ task list. */
  private writeAll(tasks: Task[]): void {
    withLock(this.filePath, () => {
      const content = tasks.map(taskToLine).join("");
      writeFileSync(this.filePath, content, "utf8");
    });
  }
}

// ---- Team Task Setup ----

/** Tạo thư mục team. */
export function ensureTeamDirectory(teamName: string): string {
  const dir = getTeamDirectory(teamName);
  mkdirSync(dir, { recursive: true });
  return dir;
}
