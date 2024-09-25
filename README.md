This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

[peanut.to](https://peanut.to) | [staging.peanut.to](https://staging.peanut.to) | [xchain.peanut.to](https://xchain.peanut.to) | [experimental.peanut.to](https://experimental.peanut.to)

## Getting Started

First install the dependencies (location: root folder):

Make sure your node version is **v18.17.0**

```bash
pnpm install
```

Secondly, copy the .env.example to .env and fill in the values:
there are 4 .env values:
1. NEXT_PUBLIC_WC_PROJECT_ID --> WalletConnect
2. PEANUT_API_KEY --> Can be found/requested from https://docs.peanut.to/integrate/using-the-sdk/api-keys
3. MOBULA_API_KEY --> Can be created from https://admin.mobula.fi/
4. NEXT_PUBLIC_GA_KEY(Google Analytics) --> Can be created from Google Cloud Platform

```bash
cp .env.example .env
```

Lastly, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
