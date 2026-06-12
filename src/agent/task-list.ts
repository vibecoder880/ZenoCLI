/**
 * Task List — file-based task coordination cho teams.
 *
 * Tasks stored as JSONL tại ~/.neurocli/teams/{name}/tasks.jsonl
 * Hỗ trợ dependencies (blocks/blockedBy), claim bằng file lock.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
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

// ---- File Lock (simple) ----

const LOCK_TIMEOUT = 5000;

function withLock(filePath: string, fn: () => void): void {
  const lockPath = filePath + ".lock";
  const start = Date.now();

  // Try to acquire lock by writing our PID
  let acquired = false;
  while (!acquired) {
    if (Date.now() - start > LOCK_TIMEOUT) {
      throw new Error(`Lock timeout: ${lockPath}`);
    }

    try {
      // Atomic create: try to write a fresh file
      // If it already exists, writeFileSync will overwrite — that's the race condition we're avoiding
      // Use a different approach: read first, then write
      const lockContent = readFileSync(lockPath, "utf8").trim();
      if (!lockContent || Date.now() - Number(lockContent) > LOCK_TIMEOUT) {
        // Stale or empty — overwrite
        writeFileSync(lockPath, String(Date.now()), "utf8");
        acquired = true;
      } else {
        // Locked by another process — busy-wait briefly
        const waitUntil = Date.now() + 10;
        while (Date.now() < waitUntil) {
          // spin
        }
      }
    } catch {
      // Lock file doesn't exist — create it
      try {
        writeFileSync(lockPath, String(Date.now()), "utf8");
        acquired = true;
      } catch {
        // Race condition — try again
      }
    }
  }

  try {
    fn();
  } finally {
    try {
      writeFileSync(lockPath, "", "utf8"); // release
    } catch {
      // ignore
    }
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
