#!/usr/bin/env node

// Compare Bridge vs Frankfurter (and optionally local /api/exchange-rate) rates
// Usage examples:
//   node scripts/compare-rates.mjs
//   node scripts/compare-rates.mjs --pairs USD:EUR,USD:MXN --api http://localhost:3000/api/exchange-rate
//   BRIDGE_API_KEY=xxx node scripts/compare-rates.mjs

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env files
function loadEnv() {
    const envFiles = ['.env.local', '.env']
    for (const file of envFiles) {
        try {
            const envPath = resolve(file)
            const envContent = readFileSync(envPath, 'utf8')
            envContent.split('\n').forEach((line) => {
                const trimmed = line.trim()
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=')
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
                        if (!process.env[key]) {
                            process.env[key] = value
                        }
                    }
                }
            })
            console.log(`Loaded environment from ${file}`)
            break
        } catch (e) {
            // File doesn't exist, continue to next
        }
    }
}

loadEnv()

const DEFAULT_PAIRS = [
    ['USD', 'EUR'],
    ['USD', 'MXN'],
    ['USD', 'BRL'],
    ['EUR', 'USD'],
    ['EUR', 'GBP'],
]

const params = process.argv.slice(2)
const pairsArg = getArg('--pairs')
const apiArg = getArg('--api')

const PAIRS = pairsArg ? pairsArg.split(',').map((p) => p.split(':').map((s) => s.trim().toUpperCase())) : DEFAULT_PAIRS

const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY

function getArg(name) {
    const i = params.indexOf(name)
    if (i === -1) return null
    return params[i + 1] || null
}

async function fetchBridge(from, to) {
    if (!BRIDGE_API_KEY) {
        return { error: 'Missing BRIDGE_API_KEY' }
    }
    const url = `https://api.bridge.xyz/v0/exchange_rates?from=${from.toLowerCase()}&to=${to.toLowerCase()}`
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Api-Key': BRIDGE_API_KEY },
    })
    if (!res.ok) {
        return { error: `${res.status} ${res.statusText}` }
    }
    const data = await res.json()
    const { midmarket_rate, buy_rate, sell_rate } = data || {}
    return { midmarket_rate, buy_rate, sell_rate }
}

async function fetchFrankfurter(from, to) {
    const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) {
        return { error: `${res.status} ${res.statusText}` }
    }
    const data = await res.json()
    const rate = data?.rates?.[to]
    return { rate, rate_995: typeof rate === 'number' ? rate * 0.995 : undefined }
}

async function fetchLocalApi(from, to) {
    if (!apiArg) return {}
    try {
        const url = `${apiArg}?from=${from}&to=${to}`
        const res = await fetch(url, { method: 'GET' })
        if (!res.ok) {
            return { error: `${res.status} ${res.statusText}` }
        }
        const data = await res.json()
        return { rate: data?.rate }
    } catch (error) {
        return { error: `Connection failed: ${error.message}` }
    }
}

function fmt(n, digits = 6) {
    return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '-'
}

function bps(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b) || b === 0)
        return '-'
    const rel = (a / b - 1) * 10000
    return `${rel.toFixed(1)} bps`
}

async function run() {
    console.log('Comparing rates...')
    if (!BRIDGE_API_KEY) {
        console.warn('Warning: BRIDGE_API_KEY not set. Bridge calls will be skipped or return errors.')
    }
    if (apiArg) {
        console.log(`Also querying local API: ${apiArg}`)
    }

    for (const [from, to] of PAIRS) {
        const [bridge, frankData, local] = await Promise.all([
            fetchBridge(from, to).catch((e) => ({ error: e?.message || String(e) })),
            fetchFrankfurter(from, to).catch((e) => ({ error: e?.message || String(e) })),
            fetchLocalApi(from, to).catch((e) => ({ error: e?.message || String(e) })),
        ])

        const bridgeBuy = bridge?.buy_rate ? Number(bridge.buy_rate) : undefined
        const bridgeMid = bridge?.midmarket_rate ? Number(bridge.midmarket_rate) : undefined
        const bridgeSell = bridge?.sell_rate ? Number(bridge.sell_rate) : undefined
        const frank = typeof frankData?.rate === 'number' ? frankData.rate : undefined
        const frank995 = typeof frankData?.rate_995 === 'number' ? frankData.rate_995 : undefined
        const localRate = typeof local?.rate === 'number' ? local.rate : undefined

        console.log(`\nPair: ${from} -> ${to}`)
        console.table([
            {
                source: 'Bridge',
                buy: fmt(bridgeBuy),
                mid: fmt(bridgeMid),
                sell: fmt(bridgeSell),
                note: bridge?.error || '',
            },
            {
                source: 'Frankfurter',
                rate: fmt(frank),
                rate_995: fmt(frank995),
                note: frankData?.error || '',
            },
            {
                source: 'Local API',
                rate: fmt(localRate),
                note: local?.error || '',
            },
        ])

        // Delta analysis table
        console.log(`\nDelta Analysis for ${from} -> ${to}:`)
        console.table([
            {
                comparison: 'Mid vs Frankfurt',
                delta: bps(bridgeMid, frank),
            },
            {
                comparison: 'Mid vs Frankfurt×0.995',
                delta: bps(bridgeMid, frank995),
            },
            {
                comparison: 'Sell vs Frankfurt×0.995',
                delta: bps(bridgeSell, frank995),
            },
            {
                comparison: 'Sell vs Mid',
                delta: bps(bridgeSell, bridgeMid),
            },
            {
                comparison: 'Buy vs Mid',
                delta: bps(bridgeBuy, bridgeMid),
            },
            {
                comparison: 'Local vs Frankfurt×0.995',
                delta: bps(localRate, frank995),
            },
        ])
    }
}

run().catch((e) => {
    console.error(e)
    process.exit(1)
})
