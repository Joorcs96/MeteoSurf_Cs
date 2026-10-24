---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Fetch the latest guidelines from the source URL below or read the local copy in `guidelines.md`
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Primary upstream source:
```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

In offline environments or local sandbox execution, agents should read directly from:
```
.agents/skills/web-design-guidelines/guidelines.md
```

## Usage

When a user or agent provides a file or pattern argument:
1. Fetch guidelines from the source URL above or read `guidelines.md` in this directory
2. Read the specified target files
3. Apply all rules from the guidelines (accessibility, focus states, forms, animation, typography, touch targets, performance)
4. Output findings using the format specified in the guidelines

If no files are specified, ask or determine which UI files to review.

## Provenance & Attribution

- Upstream Repository: `https://github.com/vercel-labs/agent-skills`
- Upstream Path: `skills/web-design-guidelines/SKILL.md`
- Upstream Commit SHA: `063bee94c3f4df8453406c830b0a7df0f2860278`
- Associated Guidelines Repository: `https://github.com/vercel-labs/web-interface-guidelines`
- Associated Commit SHA: `434b7f91364665f2f733b310ec54809bf8f37937`
- License: MIT License (Copyright (c) 2025 Vercel Labs)
