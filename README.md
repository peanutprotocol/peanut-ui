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

Then open [http://localhost:3000](http://localhost:3000) in your browser.
