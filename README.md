# Peanut UI

[![Tests](https://github.com/peanutprotocol/peanut-ui/actions/workflows/tests.yml/badge.svg)](https://github.com/peanutprotocol/peanut-ui/actions/workflows/tests.yml)
[![Code Formatting](https://github.com/peanutprotocol/peanut-ui/actions/workflows/prettier.yml/badge.svg)](https://github.com/peanutprotocol/peanut-ui/actions/workflows/prettier.yml)
[![CodeQL](https://github.com/peanutprotocol/peanut-ui/actions/workflows/codeql.yml/badge.svg)](https://github.com/peanutprotocol/peanut-ui/actions/workflows/codeql.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![i18n](https://img.shields.io/badge/i18n-5_locales-blue)](https://peanut.me)
[![PWA Ready](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa)](https://peanut.me)

Live at: [peanut.me](https://peanut.me) | [staging.peanut.me](https://staging.peanut.me)

## Getting Started

Ask in Peanut [Discord](https://discord.gg/B99T9mQqBv) #dev channel if you have any questions.

First install the dependencies (location: root folder):

```bash
git submodule update --init --recursive
pnpm install
```

```bash
cp .env.example .env
# fill in dummy values
```

```bash
pnpm dev

# Note: run pnpm run dev:https if you need to work in a secure secure context
```

Then open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Code Formatting

This project uses Prettier for code formatting. To ensure consistent code style:

1. Install the VSCode Prettier extension
2. Enable "Format on Save" in VSCode
3. Prettier will automatically format your code when you save

The CI pipeline will check formatting on all PRs. Unformatted code will block merging.

## Testing

This project uses Jest for testing. Tests are located next to their source files in `__tests__` directories.

To run tests:

```bash
# Run all tests
pnpm test

# Run tests in watch mode during development
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

### Test Structure

-   Tests are placed in `__tests__` directories next to the code they test
-   Test files should be named `*.test.ts` or `*.test.tsx`
-   Use descriptive test names that explain the expected behavior

Example:

```typescript
describe('Bank Account Formatting', () => {
    it('should format IBAN with spaces every 4 characters', () => {
        // test code
    })
})
```

The CI pipeline runs tests on all PRs. Failed tests will block merging.

## Archived Branches

This repo previously hosted two other apps under the `peanut.to` domain. Both are now deprecated in favor of `peanut.me` (this branch). Their final states are preserved as tags:

| Tag | Was | Last commit | Notes |
|-----|-----|-------------|-------|
| `archive/peanut-to` | `main` → `peanut.to` | Nov 2025 | Link-based send/claim app, cashout, SDK pages |
| `archive/legacy-peanut-to` | `legacy` → `legacy.peanut.to` | Mar 2025 | Batch send, raffles, leaderboard |

To browse the old code: `git checkout archive/peanut-to`
