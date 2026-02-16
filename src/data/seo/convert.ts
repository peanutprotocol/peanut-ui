// Typed re-exports for currency conversion data.
// Raw data lives in peanut-content (YAML). Types and logic live here.

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const yaml = matter.engines.yaml

interface ConvertData {
    pairs: string[]
    currencyDisplay: Record<string, { name: string; symbol: string }>
}

const convertData = yaml.parse(
    fs.readFileSync(path.join(process.cwd(), 'src/content/convert/pairs.yaml'), 'utf8')
) as ConvertData

export const CONVERT_PAIRS: readonly string[] = convertData.pairs
export const CURRENCY_DISPLAY: Record<string, { name: string; symbol: string }> = convertData.currencyDisplay

/** Parse a convert pair slug into from/to currencies: 'usd-to-ars' → { from: 'usd', to: 'ars' } */
export function parseConvertPair(pair: string): { from: string; to: string } | null {
    const match = pair.match(/^([a-z]+)-to-([a-z]+)$/)
    if (!match) return null
    return { from: match[1], to: match[2] }
}
