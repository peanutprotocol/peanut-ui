# Testing Philosophy

## Overview

peanut-ui uses a focused testing strategy that prioritizes **high-value tests** over coverage theater. We test critical paths that catch real bugs, not to hit arbitrary coverage percentages.

## Test Types

### 1. Unit Tests (Jest)

**Location**: Tests live with the code they test (e.g. `src/utils/foo.test.ts`)

**What we test**:
- Pure business logic (calculations, validations, transformations)
- Complex utility functions
- Critical algorithms (e.g. point calculations, country eligibility)

**What we DON'T test**:
- React components (brittle, low ROI)
- API service wrappers (thin fetch calls)
- Hooks that just wrap react-query (already tested upstream)
- JSX/UI layout (visual QA better)

**Run tests**:
- `npm test` - Run all unit tests
- `npm run test:watch` - Run tests in watch mode

### 2. E2E Tests (Playwright)

**Location**: Tests live with features they test (e.g. `src/features/card-pioneer/card-pioneer.e2e.test.ts`)

**What we test**:
- ✅ Multi-step navigation flows
- ✅ Form validation and error states
- ✅ URL state management (nuqs integration)
- ✅ Auth flows (signup, login, logout)
- ✅ UI interactions without external dependencies

**What we DON'T test**:
- ❌ Payment flows (require real transactions)
- ❌ KYC flows (external API dependencies)
- ❌ Bank transfers (real money, manual QA required)
- ❌ Wallet connections (MetaMask/WalletConnect popups)

**Why this split?**
External dependencies (payments, KYC, banks) are better tested manually because:
1. They require real credentials and real money
2. They have complex state (KYC approval status, bank account verification)
3. They involve third-party UIs (wallet popups, bank OAuth)
4. Manual QA catches edge cases E2E can't simulate

**Run tests**:
- `npm run test:e2e` - Run all E2E tests (headless)
- `npm run test:e2e:headed` - Run with browser visible
- `npm run test:e2e:ui` - Run in interactive UI mode
- `npx playwright test --grep "Card Pioneer"` - Run specific test suite
- `npx playwright test --list` - List all tests without running

## Testing Principles

### 1. Test Critical Paths Only

Focus on code that:
- Has financial impact (payment calculations, point multipliers)
- Has legal requirements (sanctions compliance, geo restrictions)
- Has security implications (reference parsing, user ID extraction)
- Is complex or hard to verify manually (date logic, ISO code mappings)

### 2. Fast Tests

- Unit tests run in ~5s
- E2E tests focus on minimal, high-value flows
- No unnecessary setup/teardown
- Mock external APIs but keep mocks simple

### 3. Tests Live With Code

Per .cursorrules: tests live where the code they test is, not in a separate folder.

```
src/
  utils/
    geo.ts
    geo.test.ts          ← unit test
  features/
    card-pioneer/
      card-pioneer.tsx
      card-pioneer.e2e.test.ts  ← e2e test
```

### 4. DRY in Tests

Reuse test utilities, shared fixtures, and helper functions. Less code is better code.

## Example Test Scenarios

### Unit Test Example

```typescript
// src/utils/country-codes.test.ts
describe('convertIso3ToIso2', () => {
  it('should convert USA to US', () => {
    expect(convertIso3ToIso2('USA')).toBe('US')
  })

  it('should handle sanctioned countries', () => {
    expect(convertIso3ToIso2('CUB')).toBe('CU') // Cuba
    expect(convertIso3ToIso2('VEN')).toBe('VE') // Venezuela
  })
})
```

### E2E Test Example

```typescript
// src/features/card-pioneer/card-pioneer.e2e.test.ts
test('user can navigate card pioneer flow', async ({ page }) => {
  await page.goto('/card-pioneer')

  // step 1: info screen
  await expect(page.getByRole('heading', { name: /card pioneer/i })).toBeVisible()
  await page.getByRole('button', { name: /get started/i }).click()

  // step 2: details screen (check URL state)
  await expect(page).toHaveURL(/step=details/)
  await page.getByRole('button', { name: /continue/i }).click()

  // step 3: geo check
  await expect(page).toHaveURL(/step=geo/)
})
```

## When to Add Tests

Add tests when:
1. Implementing new financial logic
2. Handling compliance requirements
3. Complex algorithms or data transformations
4. Bug fixes (regression tests)

Skip tests when:
1. Just rendering JSX
2. Thin wrappers around libraries
3. Purely visual changes
4. Code that's easier to verify manually

## CI Integration

- Unit tests run on every PR
- E2E tests run on PR to main
- Fail fast: first failure stops the build

## Maintenance

Keep tests:
- **Concise** - no verbose setup or comments
- **Focused** - one concern per test
- **Stable** - avoid flaky selectors or timing issues
- **Up-to-date** - delete tests for removed features

When tests fail:
1. Fix the bug (if test caught a real issue)
2. Update the test (if behavior intentionally changed)
3. Delete the test (if feature was removed)

## Resources

- Jest: https://jestjs.io/
- Playwright: https://playwright.dev/
- Testing Library: https://testing-library.com/ (for React unit tests if needed)
