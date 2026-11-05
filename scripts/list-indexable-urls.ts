#!/usr/bin/env tsx
// Print one canonical URL per line for crawl tools: pnpm tsx scripts/list-indexable-urls.ts
import { getIndexablePages } from '../src/lib/seo/url-inventory'

for (const { path } of getIndexablePages()) {
    console.log(`https://peanut.me${path}`)
}
