'use client'

/**
 * /dev/share-builder — iterator for the D3 card-waitlist share asset.
 *
 * Controls feed `<ShareAssetD3 />` so we can stress-test edge cases:
 * - 0 → 9 badges
 * - usernames 2 → 20+ chars
 * - missing / zero stats
 * - tier 0 → 3
 *
 * The "reroll seed" button forces a new layout for the same user (the
 * component is otherwise deterministic from username).
 */

import { useMemo, useState } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import ShareAssetD3 from '@/components/Card/share-asset/ShareAssetD3'
import { BADGE_CODES, getBadgeMeta } from '@/components/Card/share-asset/badgeCatalog'
import { CANVAS_W, CANVAS_H } from '@/components/Card/share-asset/shareAssetLayout'
import type { TierLevel } from '@/components/Card/share-asset/shareAsset.types'

const ALL_CODES = BADGE_CODES as readonly string[]

export default function ShareBuilderPage() {
    // ─── User inputs ─────────────────────────────────────────────────────
    const [username, setUsername] = useState('kkonrad')
    const [selectedBadges, setSelectedBadges] = useState<Set<string>>(
        new Set(['OG_2025_10_12', 'DEVCONNECT_BA_2025', 'ARBIVERSE_DEVCONNECT_BA_2025', 'CARD_PIONEER', 'BETA_TESTER', 'SUPPORT_SURVIVOR'])
    )
    const [tier, setTier] = useState<TierLevel>(3)
    const [points, setPoints] = useState(1247)
    const [last4, setLast4] = useState('5695')
    const [joinedAt, setJoinedAt] = useState('2025-10-12')
    const [movedUsd, setMovedUsd] = useState(4287)
    const [txns, setTxns] = useState(142)
    const [invited, setInvited] = useState(12)
    const [animate, setAnimate] = useState(true)
    const [seedNonce, setSeedNonce] = useState(0)
    const [previewScale, setPreviewScale] = useState(0.8)

    // Derived props — memoized so ShareAssetD3's `useMemo(...,[badges,stats])` doesn't
    // re-run on every parent render (it would, otherwise, because object/array literals
    // are fresh references each render).
    const badgesArray = useMemo(
        () =>
            [...selectedBadges].map((code, i) => ({
                code,
                // Stagger earnedAt so sorting is stable + variety in stamp year denominations.
                earnedAt: new Date(2024 + (i % 3), i % 12, 1).toISOString(),
            })),
        [selectedBadges]
    )
    const statsProp = useMemo(
        () => ({
            joinedAt: joinedAt || null,
            totalMovedUsd: movedUsd,
            totalTxns: txns,
            invitedCount: invited,
        }),
        [joinedAt, movedUsd, txns, invited]
    )

    const toggleBadge = (code: string) => {
        setSelectedBadges((prev) => {
            const next = new Set(prev)
            if (next.has(code)) next.delete(code)
            else next.add(code)
            return next
        })
    }

    const seedOverride = seedNonce > 0 ? `${username}::${seedNonce}` : undefined

    return (
        <div className="flex min-h-screen flex-col">
            <NavHeader title="Share asset builder" />

            <div className="flex flex-1 flex-col gap-8 px-6 py-6 lg:flex-row">
                {/* ─── LEFT: Controls ──────────────────────────────────── */}
                <aside className="flex flex-col gap-6 lg:w-[360px] lg:flex-shrink-0">
                    <Section title="Identity">
                        <Field label={`Username (${username.length} / 12)`}>
                            <input
                                type="text"
                                value={username}
                                maxLength={20}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                className="custom-input"
                                placeholder="kkonrad"
                            />
                        </Field>
                        <Field label="Card last 4">
                            <input
                                type="text"
                                value={last4}
                                maxLength={4}
                                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                className="custom-input"
                                placeholder="5695"
                            />
                        </Field>
                    </Section>

                    <Section title={`Badges (${selectedBadges.size} selected)`}>
                        <div className="flex flex-wrap gap-2">
                            {ALL_CODES.map((code) => (
                                <button
                                    key={code}
                                    onClick={() => toggleBadge(code)}
                                    className={`border-2 border-black rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                                        selectedBadges.has(code)
                                            ? 'bg-primary-1 text-n-1'
                                            : 'bg-white text-grey-1 hover:bg-grey-2'
                                    }`}
                                    title={code}
                                >
                                    {getBadgeMeta(code).caption}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                            <PresetButton onClick={() => setSelectedBadges(new Set())}>0 badges</PresetButton>
                            <PresetButton onClick={() => setSelectedBadges(new Set(['OG_2025_10_12']))}>
                                1 badge
                            </PresetButton>
                            <PresetButton
                                onClick={() => setSelectedBadges(new Set(['OG_2025_10_12', 'DEVCONNECT_BA_2025', 'CARD_PIONEER']))}
                            >
                                3
                            </PresetButton>
                            <PresetButton onClick={() => setSelectedBadges(new Set(ALL_CODES))}>
                                all {ALL_CODES.length}
                            </PresetButton>
                        </div>
                    </Section>

                    <Section title="Tier + points">
                        <Field label="Tier">
                            <div className="flex gap-2">
                                {[0, 1, 2, 3].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTier(t as TierLevel)}
                                        className={`flex-1 border-2 border-black rounded-sm py-2 font-bold transition-colors ${
                                            tier === t ? 'bg-primary-1' : 'bg-white hover:bg-grey-2'
                                        }`}
                                    >
                                        T{t}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label={`Points balance (${points.toLocaleString('en-US')})`}>
                            <input
                                type="range"
                                min={0}
                                max={10000}
                                step={50}
                                value={points}
                                onChange={(e) => setPoints(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                    </Section>

                    <Section title="Stats (hide when 0)">
                        <Field label="Joined date (blank = hide)">
                            <input
                                type="date"
                                value={joinedAt}
                                onChange={(e) => setJoinedAt(e.target.value)}
                                className="custom-input"
                            />
                        </Field>
                        <Field label={`USD moved ($${movedUsd.toLocaleString('en-US')})`}>
                            <input
                                type="range"
                                min={0}
                                max={50000}
                                step={50}
                                value={movedUsd}
                                onChange={(e) => setMovedUsd(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <Field label={`Total txns (${txns})`}>
                            <input
                                type="range"
                                min={0}
                                max={500}
                                step={1}
                                value={txns}
                                onChange={(e) => setTxns(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <Field label={`Invited (${invited})`}>
                            <input
                                type="range"
                                min={0}
                                max={50}
                                step={1}
                                value={invited}
                                onChange={(e) => setInvited(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                    </Section>

                    <Section title="Layout">
                        <Field label={`Preview scale (${previewScale.toFixed(2)}×)`}>
                            <input
                                type="range"
                                min={0.3}
                                max={1}
                                step={0.05}
                                value={previewScale}
                                onChange={(e) => setPreviewScale(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <div className="flex gap-2">
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="flex-1"
                                onClick={() => setSeedNonce((n) => n + 1)}
                            >
                                Reroll seed
                            </Button>
                            <Button
                                variant="stroke"
                                shadowSize="4"
                                className="flex-1"
                                onClick={() => setAnimate((a) => !a)}
                            >
                                {animate ? '✓ Animate' : 'Animate off'}
                            </Button>
                        </div>
                    </Section>

                    <Section title="Edge-case shortcuts">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <PresetButton onClick={() => setUsername('me')}>2-char user</PresetButton>
                            <PresetButton onClick={() => setUsername('twelvechars1')}>
                                12 chars (max)
                            </PresetButton>
                            <PresetButton onClick={() => setUsername('thisistwentyplus_chars')}>
                                20+ chars
                            </PresetButton>
                            <PresetButton
                                onClick={() => {
                                    setMovedUsd(0)
                                    setTxns(0)
                                    setInvited(0)
                                    setJoinedAt('')
                                }}
                            >
                                Zero stats
                            </PresetButton>
                            <PresetButton
                                onClick={() => {
                                    setMovedUsd(0)
                                    setTxns(0)
                                    setInvited(0)
                                    setJoinedAt('')
                                    setSelectedBadges(new Set())
                                    setTier(0)
                                    setPoints(0)
                                }}
                            >
                                Brand-new user
                            </PresetButton>
                            <PresetButton
                                onClick={() => {
                                    setMovedUsd(1_500_000)
                                    setTxns(9999)
                                    setInvited(50)
                                    setPoints(9999)
                                    setTier(3)
                                    setSelectedBadges(new Set(ALL_CODES))
                                }}
                            >
                                Whale user
                            </PresetButton>
                        </div>
                        {username.length > 12 && (
                            <p className="text-[10px] text-red mt-2 font-bold leading-snug">
                                ⚠️ Username &gt; 12 chars · production caps at 12. The asset
                                shrinks the @username pill defensively, but check the input gate
                                in your caller.
                            </p>
                        )}
                    </Section>
                </aside>

                {/* ─── RIGHT: Preview ──────────────────────────────────── */}
                <main className="flex-1 flex flex-col gap-4">
                    <div className="border border-n-1 rounded-sm bg-grey-3 p-2 flex items-center justify-between text-xs">
                        <span className="font-mono">
                            {CANVAS_W} × {CANVAS_H} · scaled {(previewScale * 100).toFixed(0)}%
                        </span>
                        <span className="font-mono text-grey-1">
                            seed: {seedOverride ?? username ?? 'anon'}
                        </span>
                    </div>
                    <div
                        className="border-2 border-n-1 rounded-sm bg-background overflow-auto"
                        style={{ minHeight: 200 }}
                    >
                        <div
                            style={{
                                width: CANVAS_W * previewScale,
                                height: CANVAS_H * previewScale,
                                position: 'relative',
                            }}
                        >
                            <div
                                style={{
                                    width: CANVAS_W,
                                    height: CANVAS_H,
                                    transform: `scale(${previewScale})`,
                                    transformOrigin: 'top left',
                                }}
                            >
                                <ShareAssetD3
                                    // Remount ONLY for things that require replaying the CSS
                                    // animations from scratch — reroll + animate toggle. Every
                                    // other input change re-renders in place (cheap).
                                    key={`${seedNonce}-${animate}`}
                                    username={username || 'anon'}
                                    badges={badgesArray}
                                    stats={statsProp}
                                    tier={tier}
                                    pointsBalance={points}
                                    cardLast4={last4}
                                    seedOverride={seedOverride}
                                    animate={animate}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border border-n-1 rounded-sm bg-white p-4 text-xs space-y-2">
                        <div className="font-bold uppercase tracking-wider text-grey-1">Resulting props</div>
                        <pre className="font-mono text-[11px] overflow-auto whitespace-pre-wrap">
                            {JSON.stringify(
                                {
                                    username,
                                    badges: badgesArray.map((b) => b.code),
                                    stats: statsProp,
                                    tier,
                                    pointsBalance: points,
                                    cardLast4: last4,
                                    seedOverride,
                                },
                                null,
                                2
                            )}
                        </pre>
                    </div>
                </main>
            </div>
        </div>
    )
}

// ─── Small UI primitives ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="border-2 border-n-1 rounded-sm bg-white shadow-4 p-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider mb-3 text-grey-1">{title}</h2>
            <div className="flex flex-col gap-3">{children}</div>
        </section>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-grey-1">{label}</span>
            {children}
        </label>
    )
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="border border-n-1 rounded-full bg-white hover:bg-grey-2 px-2 py-1 text-xs font-bold transition-colors"
        >
            {children}
        </button>
    )
}
