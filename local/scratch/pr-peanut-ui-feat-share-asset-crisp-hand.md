PR: https://github.com/peanutprotocol/peanut-ui/pull/2516   base: dev   worktree: mono/worktrees/peanut-ui-feat/share-asset-crisp-hand
phase: 3 (CI)            last-tick: 873c98aff
checks: prettier ✅ typecheck ✅ unit ✅ (162 suites) build ✅ (needs --max-old-space-size=5120 locally; default heap OOMs on this box)
coderabbit: not yet pulled
code-review: not yet run
smells: TBD
screenshots: attached via orphan branch pr-assets-2516 (DELETE post-merge)
reporters: Konrad (this session) — no Crisp/Notion ticket
notes:
  - worktree has its OWN node_modules (not symlinked): primary peanut-ui tree is on a stale dev
    without the @capacitor/* deps, which broke next dev + 3 test suites. pnpm via `corepack pnpm`
    (global /usr/bin/pnpm is too old for the packages-less pnpm-workspace.yaml).
  - dev server on this box dies mid-compile under memory pressure; screenshots were taken through
    a throwaway route (deleted) rather than the real-backend phase-2b pipeline. Documented in the PR body.
todo: watch CI → CodeRabbit → /code-review → smell pass → readiness report
