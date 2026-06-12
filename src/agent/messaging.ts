/**
 * Messaging System — mailbox cho teammates.
 *
 * Mỗi teammate có 1 mailbox file JSONL.
 * Messages: plain text, plan approval, shutdown, task update.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import crypto from "node:crypto";
import { getMailboxPath } from "../storage/paths.js";

// ---- Types ----

export type MessageType = "text" | "plan_approval_request" | "plan_approval_response" | "shutdown_request" | "shutdown_response" | "task_update" | "broadcast";

export interface Message {
  id: string;
  /** Teammate gửi. */
  from: string;
  /** Teammate nhận (hoặc "*" cho broadcast). */
  to: string;
  type: MessageType;
  /** Nội dung text. */
  content: string;
  /** Optional metadata (plan, task, etc.). */
  metadata?: Record<string, unknown>;
  timestamp: string;
  /** Đã đọc chưa. */
  read: boolean;
}

// ---- Helpers ----

function generateMessageId(): string {
  return `msg_${crypto.randomBytes(4).toString("hex")}`;
}

function messageToLine(msg: Message): string {
  return JSON.stringify(msg) + "\n";
}

function lineToMessage(line: string): Message | null {
  try {
    return JSON.parse(line.trim()) as Message;
  } catch {
    return null;
  }
}

// ---- Mailbox ----

export class Mailbox {
  private readonly filePath: string;

  constructor(
    readonly teamName: string,
    readonly teammate: string,
  ) {
    this.filePath = getMailboxPath(teamName, teammate);
  }

  /** Gửi message tới một teammate khác. */
  send(to: string, content: string, type: MessageType = "text", metadata?: Record<string, unknown>): Message {
    const message: Message = {
      id: generateMessageId(),
      from: this.teammate,
      to,
      type,
      content,
      metadata,
      timestamp: new Date().toISOString(),
      read: false,
    };

    appendFileSync(this.filePath, messageToLine(message), "utf8");
    return message;
  }

  /** Gửi tới tất cả teammates (broadcast). */
  broadcast(content: string, type: MessageType = "broadcast", metadata?: Record<string, unknown>): Message {
    return this.send("*", content, type, metadata);
  }

  /** Đọc messages (mặc định chỉ unread). */
  read(unreadOnly = true): Message[] {
    if (!existsSync(this.filePath)) return [];

    const lines = readFileSync(this.filePath, "utf8").split("\n").filter(Boolean);
    const messages: Message[] = [];

    for (const line of lines) {
      const msg = lineToMessage(line);
      if (msg) messages.push(msg);
    }

    return unreadOnly ? messages.filter((m) => !m.read) : messages;
  }

  /** Đánh dấu message đã đọc. */
  markRead(messageId: string): void {
    if (!existsSync(this.filePath)) return;

    const lines = readFileSync(this.filePath, "utf8").split("\n").filter(Boolean);
    const updated = lines
      .map((line) => {
        const msg = lineToMessage(line);
        if (msg && msg.id === messageId) {
          return messageToLine({ ...msg, read: true });
        }
        return line;
      })
      .join("\n");

    writeFileSync(this.filePath, updated, "utf8");
  }

  /** Đánh dấu tất cả đã đọc. */
  markAllRead(): void {
    if (!existsSync(this.filePath)) return;

    const lines = readFileSync(this.filePath, "utf8").split("\n").filter(Boolean);
    const updated = lines
      .map((line) => {
        const msg = lineToMessage(line);
        if (msg) {
          return messageToLine({ ...msg, read: true });
        }
        return line;
      })
      .join("\n");

    writeFileSync(this.filePath, updated, "utf8");
  }

  /** Xóa tất cả messages. */
  clear(): void {
    writeFileSync(this.filePath, "", "utf8");
  }

  /** Đếm unread messages. */
  get unreadCount(): number {
    return this.read(true).length;
  }
}

// ---- Reply helpers ----

/** Tạo plan approval request. */
export function createPlanApprovalRequest(
  mailbox: Mailbox,
  to: string,
  plan: string,
  planId: string,
): Message {
  return mailbox.send(to, `Plan approval requested: ${plan.slice(0, 100)}...`, "plan_approval_request", { planId, plan });
}

/** Tạo plan approval response. */
export function createPlanApprovalResponse(
  mailbox: Mailbox,
  to: string,
  approved: boolean,
  feedback?: string,
): Message {
  return mailbox.send(
    to,
    approved ? "Plan approved" : `Plan rejected: ${feedback ?? "no feedback"}`,
    "plan_approval_response",
    { approved, feedback },
  );
}

/** Tạo shutdown request. */
export function createShutdownRequest(mailbox: Mailbox, to: string, reason?: string): Message {
  return mailbox.send(to, reason ?? "Shutdown requested", "shutdown_request", { reason });
}
