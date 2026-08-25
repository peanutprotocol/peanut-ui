'use client'

/**
 * /share-gallery — QA gallery that renders the REAL <ShareAssetD3 /> for a
 * representative + extreme sweep of (username, badges) combos, at native
 * 1200×900, animation off. Used to eyeball / screenshot the actual shipped
 * asset (not a mockup) across the realistic range — e.g. verifying the
 * username pill is never covered by a badge sticker.
 *
 * Top-level route (outside the (mobile-ui) group) so it renders without the
 * mobile browser-gate / auth redirect. Each asset is wrapped in a
 * `[data-card]` node sized to native 1200×900 for full-fidelity screenshots.
 */

import ShareAssetD3 from '@/components/Card/share-asset/ShareAssetD3'
import type { ShareAssetBadge } from '@/components/Card/share-asset/shareAsset.types'

type Cfg = { username: string; codes: string[]; tag: string; extreme?: boolean }

const REP: Cfg[] = [
    { username: 'kkonrad', codes: ['OG_2025_10_12', 'DEVCONNECT_BA_2025', 'CARD_ALPHA'], tag: '3 badges' },
    { username: 'hugo', codes: ['CARD_PIONEER', 'BETA_TESTER'], tag: '2 badges' },
    {
        username: 'jota',
        codes: ['OG_2025_10_12', 'MOST_PAYMENTS_DEVCON', 'BIG_SPENDER_5K', 'MOST_RESTAURANTS_DEVCON'],
        tag: '4 badges',
    },
    { username: 'kush', codes: ['CARD_CLOSED_BETA', 'BUG_WHISPERER', 'TOUCHED_GRASS'], tag: '3 badges' },
    { username: 'satoshi', codes: ['OG_2025_10_12'], tag: '1 badge' },
    {
        username: 'mara',
        codes: ['FIRST_INVITE', 'SECOND_INVITE', 'THIRD_INVITE', 'MOST_INVITES', 'INFLUENCER_25'],
        tag: '5 badges',
    },
    { username: 'degen', codes: ['BIG_SPENDER_5K', 'CARD_SPENT_1K'], tag: '2 badges' },
    { username: 'nomad', codes: ['IRL_NOMADS', 'TOUCHED_GRASS', 'EVENT_ALUMNI'], tag: '3 badges' },
    { username: 'alice', codes: ['MOST_RESTAURANTS_DEVCON', 'CARD_FIRST_SWIPE'], tag: '2 badges' },
    {
        username: 'bob',
        codes: ['VERIFIED', 'OG_2025_10_12', 'CARD_ALPHA', 'DEVCONNECT_BA_2025', 'BETA_TESTER', 'PRODUCT_HUNT'],
        tag: '6 badges',
    },
    { username: 'crypto_carla', codes: ['CERTIFIED_YAPPER', 'GIGA_YAPPER'], tag: '2 badges' },
    {
        username: 'yieldmaster',
        codes: ['BIG_SPENDER_5K', 'OFFRAMP_USER', 'CARD_SPENT_1K', 'DOUBLE_DIGITS'],
        tag: '4 badges',
    },
    {
        username: 'pixel',
        codes: ['ARBIVERSE_DEVCONNECT_BA_2025', 'SEEDLING_DEVCONNECT_BA_2025', 'ARBITRUM'],
        tag: '3 badges',
    },
    { username: 'luna', codes: ['SHHHHH', 'NOT_SO_SHHHH'], tag: '2 badges' },
    { username: 'victor', codes: ['OG_2025_10_12', 'FOUNDING_PIONEER', 'CARD_CLOSED_BETA'], tag: '3 badges' },
    { username: 'sam', codes: ['STREAK_SPARK', 'STREAK_BLAZE', 'STREAK_WILDFIRE'], tag: '3 badges' },
    { username: 'mei', codes: ['FESTA_JUNINA_2026', 'TOKEN_NATION_SP_2026'], tag: '2 badges' },
    { username: 'devdan', codes: ['BUG_WHISPERER', 'BETA_TESTER', 'PSYOPS_DIVISION', 'VERIFIED'], tag: '4 badges' },
    { username: 'priya', codes: ['FIRST_CRUMB', 'MOST_RESTAURANTS_DEVCON', 'CARD_FIRST_SWIPE'], tag: '3 badges' },
    { username: 'tomas', codes: ['ETHFLORIPA_HUB', 'IRL_NOMADS'], tag: '2 badges' },
]

const EXTREME: Cfg[] = [
    { username: 'x', codes: ['OG_2025_10_12', 'CARD_ALPHA'], tag: '1-char handle · biggest stickers', extreme: true },
    {
        username: 'twelvecharss',
        codes: ['OG_2025_10_12', 'BETA_TESTER'],
        tag: '12-char max handle · widest pill',
        extreme: true,
    },
    {
        username: '🥜degen🥜',
        codes: ['OG_2025_10_12', 'CARD_SPENT_1K', 'MOST_RESTAURANTS_DEVCON'],
        tag: 'emoji handle · seed edge case',
        extreme: true,
    },
    {
        username: 'collector',
        codes: [
            'OG_2025_10_12',
            'DEVCONNECT_BA_2025',
            'BETA_TESTER',
            'MOST_RESTAURANTS_DEVCON',
            'BIG_SPENDER_5K',
            'CARD_SPENT_1K',
            'VERIFIED',
            'TOUCHED_GRASS',
            'CARD_ALPHA',
            'BUG_WHISPERER',
        ],
        tag: '10 badges · dense field',
        extreme: true,
    },
    {
        username: 'whale',
        codes: [
            'OG_2025_10_12',
            'DEVCONNECT_BA_2025',
            'BETA_TESTER',
            'MOST_RESTAURANTS_DEVCON',
            'BIG_SPENDER_5K',
            'CARD_SPENT_1K',
            'VERIFIED',
            'TOUCHED_GRASS',
            'CARD_ALPHA',
            'BUG_WHISPERER',
            'MOST_INVITES',
            'STREAK_WILDFIRE',
        ],
        tag: '12 badges · stacking regime',
        extreme: true,
    },
]

const ALL = [...REP, ...EXTREME]

function toBadges(codes: string[]): ShareAssetBadge[] {
    // Stagger earnedAt so the most-recent-first sort is stable & deterministic.
    return codes.map((code, i) => ({ code, earnedAt: new Date(2024, i % 12, 1).toISOString() }))
}

export default function ShareGalleryPage() {
    return (
        <div style={{ background: '#0f1115', minHeight: '100vh', padding: 24 }}>
            <h1 style={{ color: '#e8eaf0', font: '700 20px system-ui', margin: '0 0 4px' }}>
                Share-asset gallery — REAL &lt;ShareAssetD3 /&gt; · 20 representative + 5 extreme
            </h1>
            <p style={{ color: '#9aa0ad', font: '13px system-ui', margin: '0 0 24px' }}>
                Native 1200×900, animation off, real badge art + pixel card. Each frame is the actual shipped component.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {ALL.map((c, i) => (
                    <div key={i}>
                        <div
                            style={{
                                color: c.extreme ? '#ffc857' : '#e8eaf0',
                                font: '600 15px system-ui',
                                margin: '0 0 8px',
                            }}
                        >
                            {c.extreme ? '⚠ EXTREME · ' : ''}
                            <b>{c.username}</b> <span style={{ color: '#9aa0ad', fontWeight: 400 }}>— {c.tag}</span>
                        </div>
                        <div data-card={c.username} style={{ width: 1200, height: 900 }}>
                            <ShareAssetD3 username={c.username} badges={toBadges(c.codes)} animate={false} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
