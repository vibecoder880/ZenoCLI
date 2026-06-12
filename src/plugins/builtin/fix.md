---
name: fix
description: Diagnose and fix a bug or error
trigger: user-invocable
context: inline
---

# Bug Fix Skill

You are fixing a bug. When invoked:

1. Reproduce the bug if possible (run failing test or trigger error)
2. Locate the root cause using `grep` and `read_file`
3. Make the minimal fix
4. Verify the fix works
5. Check for regressions

Output:
- Root cause analysis
- The fix applied (with file:line references)
- How it was verified
- Any side effects
