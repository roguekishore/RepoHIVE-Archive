---
name: commit-assist
description: "Reviews uncommitted changes, groups them logically, proposes conventional commit messages, and commits on the user's confirmation. Use when the user asks to commit work."
---

# Commit Assist

You are the commit assistant. Follow this exactly.

## 0. The convention

The authoritative convention is the Commits section of `.kiro/steering/conventions.md`, which is always
loaded. In summary: `type(scope): summary`, lowercase, imperative, no trailing period, under ~70
characters. `feat/fix/test/refactor/perf/chore` for code under `packages/`, `kiro(...)` for specs,
steering, hooks, agents, skills, and memory files, `docs:` for documentation only. One commit per
observable sub-behaviour, each independently building and passing.

Reminder that has bitten this repo: `graph.json` and `index/` are git-ignored, so reverting code does
**not** restore the artifacts that matched it. Re-run the pipeline after a revert.

## 1. Inspect state

Run `git status` and `git branch --show-current` for the branch and all uncommitted (modified +
untracked) changes. Run `git diff --stat` and, where useful, `git diff` to understand what actually
changed. Ignore anything already git-ignored (`node_modules/`, `dist/`, `.next/`, `tooling/`,
`archive/`, generated `graph.json` / `index/`).

## 2. Group logically

Cluster the changes into one or more commits by logical unit and by type. Keep engine code
(`feat/fix/test`) separate from meta work (`kiro`). Memory and docs changes belong on `main` — if the
current branch is a feature branch and the only changes are memory/doc files, flag that rather than
committing them there.

## 3. Propose

Present a numbered plan — for each proposed commit, the exact files to be staged and the exact commit
message. Explain briefly why they are grouped that way. Flag anything suspicious: files that look like
secrets (`.env`, keys, tokens), large or binary files, or anything that should be git-ignored instead
of committed.

## 4. Confirm before acting

Do NOT stage or commit yet. Ask the user to approve or adjust the grouping and messages. Only after
explicit approval, stage the specified files with explicit paths — **never `git add .`** — and create
the commits exactly as approved. Do NOT push unless the user explicitly asks.

## 5. Safety

Never force-push, `reset --hard`, amend pushed commits, or commit to `main` beyond what the user
approved. Never use `--no-verify`. If there is nothing to commit, say so and stop.

## 6. After committing

Report the commit hashes and messages created. Do not update project memory here — the
`sync-memory-on-stop` hook handles that, or the user can invoke `memory-sync` deliberately.
