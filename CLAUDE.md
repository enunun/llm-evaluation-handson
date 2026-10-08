# llm-evaluation-handson

A Japanese hands-on course on evaluating generative-AI products under nondeterminism.
Learners grow a small LLM feature (support-inquiry classification and reply drafting), evaluate it with promptfoo, and build the analysis CLI `evalstats` over six Iterations, test-first.
The course is built with the `build-handson` skill of `enunun/system-development-skills`.
`COURSE.md` holds the course plan and conventions; `docs/ROADMAP.md` is the only source of what each Iteration builds.

# RTK (Rust Token Killer)

Prefix every shell command with `rtk`, including each command in an `&&` chain — it is always safe (a dedicated filter cuts noisy output for tests, builds, git, and more; anything without one passes through unchanged). The full command reference is in the global `~/.claude/RTK.md` (already loaded, if set up). Meta commands: `rtk gain` (savings so far), `rtk discover` (missed opportunities in past sessions), `rtk proxy <cmd>` (run unfiltered, for debugging).

## Working conventions

- Build one Iteration at a time, following `COURSE.md` and `docs/ROADMAP.md`. Iteration N's exercise must equal Iteration N-1's solution apart from the package name and prose.
- Output shown in the material must come from real runs.
- TypeScript runs without a build step (Node type stripping): import with `.ts` extensions and use only erasable syntax.

- `git commit` runs the lefthook hooks. If they fail, fix the reported issues. Do not use `--no-verify`.

- Run `mise run check` after making changes.

## Code map

- `COURSE.md`: course plan for builders (audience, tools, layout, commands, pitfalls).
- `docs/`: learner guides (`ROADMAP.md`, `tdd.md`, `design.md`) and per-Iteration notes (`notes/`).
- `iterations/iteration-N/{exercise,solution}/`: pnpm workspace packages. Each has `src/`, `test/unit/`, `test/integration/`, `design/`, `docs/iteration-N.md`, `promptfooconfig.yaml`.
- `scripts/`: Mermaid syntax check and the design-to-code check run by `mise run check`.

# Artifact Cleanup

## Golden Rule

**Whenever you produce an artifact, always run the `system-development-skills:finalize-artifacts` skill to clean it up before reporting the work as done.**

An artifact is any deliverable you create or substantially rewrite: documents, READMEs, code and code comments, config files, scripts, commit messages, PR descriptions, and so on.

- Invoke the skill via the Skill tool (`system-development-skills:finalize-artifacts`) after the artifact is written and before the final reply.
- The skill edits the artifact files in place. Do not append a changelog of the cleanup to the artifact; in the final reply, mention what changed in a sentence or two at most unless the user asks for a full report.
- Skip it only for replies that produce no artifact (answering questions, explaining code, running read-only commands).
- Provided by the `enunun/system-development-skills` plugin (see `extraKnownMarketplaces`/`enabledPlugins` in `.claude/settings.json`).
