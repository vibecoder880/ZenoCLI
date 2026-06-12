/**
 * Built-in Skills — starter skills for common workflows.
 * Loaded from ./builtin/ directory at session start.
 */

---
name: review
description: Review code changes for bugs and quality issues
trigger: user-invocable
context: inline
---

# Code Review Skill

You are reviewing code changes. When invoked:

1. Run `git diff` to see recent changes
2. Analyze the changes for:
   - Bugs and logic errors
   - Edge cases and error handling
   - Security issues
   - Performance concerns
   - Code style and conventions
3. Provide a structured review with:
   - Summary of changes
   - Issues found (severity: critical, major, minor)
   - Specific suggestions with line numbers
   - Positive observations

Be concise and actionable.
