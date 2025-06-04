Live at: [peanut.to](https://peanut.to) | [staging.peanut.to](https://staging.peanut.to)

## Getting Started

Ask in Peanut [Discord](https://discord.gg/B99T9mQqBv) #dev channel if you have any questions.

First install the dependencies (location: root folder):

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm dev
```

## Initializing the `src/assets/animations` Submodule

This repo uses a Git submodule for all animation assets. After cloning, run:

```bash
git submodule init
git submodule update
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
