import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { Mailbox, createPlanApprovalRequest, createPlanApprovalResponse, createShutdownRequest } from "./messaging.js";

const testDir = path.join(os.tmpdir(), `.zeno-test-mailbox-${Date.now()}`);

beforeEach(() => {
  process.env.HOME = testDir;
  process.env.USERPROFILE = testDir;
});

afterEach(() => {
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("Mailbox", () => {
  it("sends a message", () => {
    const mb = new Mailbox("test-team", "alice");
    const msg = mb.send("bob", "Hello Bob");

    expect(msg.from).toBe("alice");
    expect(msg.to).toBe("bob");
    expect(msg.content).toBe("Hello Bob");
    expect(msg.read).toBe(false);
  });

  it("reads messages", () => {
    const mb = new Mailbox("test-team", "alice");
    mb.send("bob", "Hello");
    mb.send("bob", "World");

    const messages = mb.read();
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].content).toBe("World");
  });

  it("filters unread messages by default", () => {
    const mb = new Mailbox("test-team", "alice");
    const msg1 = mb.send("bob", "First");
    mb.send("bob", "Second");

    mb.markRead(msg1.id);

    const unread = mb.read(true);
    expect(unread).toHaveLength(1);
    expect(unread[0].content).toBe("Second");
  });

  it("counts unread messages", () => {
    const mb = new Mailbox("test-team", "alice");
    expect(mb.unreadCount).toBe(0);

    mb.send("bob", "Msg 1");
    mb.send("bob", "Msg 2");
    mb.send("bob", "Msg 3");

    expect(mb.unreadCount).toBe(3);
  });

  it("broadcasts to all teammates", () => {
    const mb = new Mailbox("test-team", "alice");
    const msg = mb.broadcast("Standup in 5 minutes");

    expect(msg.to).toBe("*");
    expect(msg.type).toBe("broadcast");
  });

  it("marks all as read", () => {
    const mb = new Mailbox("test-team", "alice");
    mb.send("bob", "Msg 1");
    mb.send("bob", "Msg 2");
    expect(mb.unreadCount).toBe(2);

    mb.markAllRead();
    expect(mb.unreadCount).toBe(0);
  });

  it("clears mailbox", () => {
    const mb = new Mailbox("test-team", "alice");
    mb.send("bob", "Msg 1");
    mb.send("bob", "Msg 2");

    mb.clear();
    expect(mb.read()).toHaveLength(0);
  });
});

describe("createPlanApprovalRequest", () => {
  it("creates plan approval request message", () => {
    const mb = new Mailbox("test-team", "coordinator");
    const msg = createPlanApprovalRequest(mb, "user", "Plan: implement X", "plan-123");

    expect(msg.type).toBe("plan_approval_request");
    expect(msg.metadata?.planId).toBe("plan-123");
  });
});

describe("createPlanApprovalResponse", () => {
  it("creates approval response", () => {
    const mb = new Mailbox("test-team", "user");
    const msg = createPlanApprovalResponse(mb, "coordinator", true);

    expect(msg.type).toBe("plan_approval_response");
    expect(msg.metadata?.approved).toBe(true);
  });

  it("creates rejection with feedback", () => {
    const mb = new Mailbox("test-team", "user");
    const msg = createPlanApprovalResponse(mb, "coordinator", false, "Need more details");

    expect(msg.metadata?.approved).toBe(false);
    expect(msg.metadata?.feedback).toBe("Need more details");
  });
});

describe("createShutdownRequest", () => {
  it("creates shutdown request", () => {
    const mb = new Mailbox("test-team", "coordinator");
    const msg = createShutdownRequest(mb, "teammate", "All tasks done");

    expect(msg.type).toBe("shutdown_request");
    expect(msg.metadata?.reason).toBe("All tasks done");
  });
});
