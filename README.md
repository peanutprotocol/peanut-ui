Live at: [peanut.to](https://peanut.to) | [staging.peanut.to](https://staging.peanut.to)

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

Then pen [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Code Formatting

This project uses Prettier for code formatting. To ensure consistent code style:

1. Install the VSCode Prettier extension
2. Enable "Format on Save" in VSCode
3. Prettier will automatically format your code when you save

The CI pipeline will check formatting on all PRs. Unformatted code will block merging.
