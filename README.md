# Peanut UI

[![Tests](https://github.com/peanutprotocol/peanut-ui/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/peanutprotocol/peanut-ui/actions/workflows/tests.yml)
[![CodeQL](https://github.com/peanutprotocol/peanut-ui/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/peanutprotocol/peanut-ui/security/code-scanning)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![i18n](https://img.shields.io/badge/i18n-5_locales-blue)](https://peanut.me)
[![PWA Ready](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa)](https://peanut.me)

Live at: [peanut.me](https://peanut.me) | [staging.peanut.me](https://staging.peanut.me)

## Getting Started

**Local dev and QA: start from mono root, not here.**

```bash
cd ..                       # mono root
./scripts/dev               # brings up API :5050 + UI :3050 + Nutcracker :3060
```

Then open [http://localhost:3050](http://localhost:3050). See [`mono/GETTING-STARTED.md`](../GETTING-STARTED.md) → "Running the app locally" for the full cheat sheet, log paths, and in-browser `peanutDebug.*` helpers.

Ask in Peanut [Discord](https://discord.gg/B99T9mQqBv) #dev channel if you have any questions.

### pnpm dev (escape hatch)

Running `pnpm dev` in this subrepo directly bypasses the sandbox env overrides (`PEANUT_API_URL`, chain IDs, bundler URLs, `NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK`, Infura disable) injected by `mono/engineering/qa/lib/servers.sh`. By default the UI will talk to staging — rarely what you want for local QA.

```bash
git submodule update --init --recursive
pnpm install
cp .env.example .env         # edit as needed
pnpm dev                     # listens on :3000
# pnpm run dev:https         # HTTPS dev server (secure-context features)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for coding standards, design system reference, and development rules.

## Archived Branches

This repo previously hosted two other apps under the `peanut.to` domain. Both are now deprecated in favor of `peanut.me` (this branch). Their final states are preserved as tags:

| Tag | Was | Last commit | Notes |
|-----|-----|-------------|-------|
| `archive/peanut-to` | `main` → `peanut.to` | Nov 2025 | Link-based send/claim app, cashout, SDK pages |
| `archive/legacy-peanut-to` | `legacy` → `legacy.peanut.to` | Mar 2025 | Batch send, raffles, leaderboard |

To browse the old code: `git checkout archive/peanut-to`
