'use client'

/**
 * /dev/share-builder — iterator for the card share asset (sticker collage).
 *
 * Controls feed `<ShareAssetD3 />` so we can stress-test edge cases:
 * - 0 → all badges (sticker count drives the force-directed layout)
 * - usernames 2 → 20+ chars (the @username pill auto-shrinks)
 *
 * The asset is now a pure sticker collage — card in the middle, badges
 * slapped around it, @username pill. There are no stats / tier / points /
 * card-number inputs anymore; the layout is driven entirely by the badge
 * set + username seed. "Reroll seed" forces a new force-directed layout for
 * the same user (otherwise deterministic from username).
 */

import { useMemo, useRef, useState } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import ShareAssetD3 from '@/components/Card/share-asset/ShareAssetD3'
import type { HeroVariant, UsernameBg } from '@/components/Card/share-asset/shareAsset.types'
import { captureShareAsset, downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import { BADGE_CODES, getBadgeDisplayName } from '@/components/Badges/badge.utils'
import { CANVAS_W, CANVAS_H } from '@/components/Card/share-asset/shareAssetLayout'

const ALL_CODES = BADGE_CODES

export default function ShareBuilderPage() {
    // ─── User inputs ─────────────────────────────────────────────────────
    const [username, setUsername] = useState('kkonrad')
    const [selectedBadges, setSelectedBadges] = useState<Set<string>>(
        new Set([
            'OG_2025_10_12',
            'DEVCONNECT_BA_2025',
            'ARBIVERSE_DEVCONNECT_BA_2025',
            'CARD_PIONEER',
            'BETA_TESTER',
            'SUPPORT_SURVIVOR',
        ])
    )
    const [animate, setAnimate] = useState(true)
    const [seedNonce, setSeedNonce] = useState(0)
    const [previewScale, setPreviewScale] = useState(0.8)
    const [hideUsername, setHideUsername] = useState(false)

    // ─── Capture (Save image) ────────────────────────────────────────────
    // Ref points at the native-size asset node (the pre-scale div) so the
    // capture renders at full 1200×900 fidelity. `assetReady` flips once the
    // card face's async hand <canvas> mounts (ShareAssetD3.onReady) — Save is
    // disabled until then so a capture can never snapshot a blank card.
    const assetRef = useRef<HTMLDivElement>(null)
    const [assetReady, setAssetReady] = useState(false)
    const [saving, setSaving] = useState(false)
    const handleSave = async () => {
        const node = assetRef.current
        if (!node) return
        setSaving(true)
        try {
            const blob = await captureShareAsset(node)
            downloadBlob(blob, 'peanut-card.png')
        } catch (err) {
            console.error('[share-builder] save failed', err)
        } finally {
            setSaving(false)
        }
    }

    // ─── Hero "I got in" message sticker ─────────────────────────────────
    const [heroVariant, setHeroVariant] = useState<HeroVariant | 'none'>('burst')
    const [heroText, setHeroText] = useState("I'M IN!")
    const [heroScale, setHeroScale] = useState(1.15)
    const [heroTilt, setHeroTilt] = useState(5)
    const heroMessage =
        heroVariant === 'none' ? null : { text: heroText, variant: heroVariant, scale: heroScale, tilt: heroTilt }

    // ─── Username pill colour + typography ───────────────────────────────
    const [unameBg, setUnameBg] = useState<UsernameBg>('white')
    const [unamePrefix, setUnamePrefix] = useState(0.5)
    const [unameScale, setUnameScale] = useState(1)
    const [unameTracking, setUnameTracking] = useState(0)
    const usernameStyle = {
        bg: unameBg,
        prefixRatio: unamePrefix,
        scale: unameScale,
        letterSpacing: unameTracking,
    }

    // Derived props — memoized so ShareAssetD3's `useMemo(...,[badges])` doesn't
    // re-run on every parent render (it would, otherwise, because array literals
    // are fresh references each render).
    const badgesArray = useMemo(
        () =>
            [...selectedBadges].map((code, i) => ({
                code,
                // Stagger earnedAt so the most-recent-first sort is stable.
                earnedAt: new Date(2024 + (i % 3), i % 12, 1).toISOString(),
            })),
        [selectedBadges]
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
                    <Section title="Hero message (I got in)">
                        <Field label="Sticker type">
                            <div className="flex flex-wrap gap-2">
                                {(['none', 'burst', 'pill', 'banner'] as const).map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => setHeroVariant(v)}
                                        className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold transition-colors ${
                                            heroVariant === v
                                                ? 'bg-primary-1 text-n-1'
                                                : 'bg-white text-grey-1 hover:bg-grey-2'
                                        }`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Copy">
                            <input
                                type="text"
                                value={heroText}
                                maxLength={28}
                                onChange={(e) => setHeroText(e.target.value)}
                                className="custom-input"
                                placeholder="I'M IN"
                            />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                            <PresetButton onClick={() => setHeroText("I'M IN")}>I&apos;M IN</PresetButton>
                            <PresetButton onClick={() => setHeroText("shhhh, i'm in")}>shhhh, i&apos;m in</PresetButton>
                            <PresetButton onClick={() => setHeroText('ACCESS GRANTED')}>ACCESS GRANTED</PresetButton>
                            <PresetButton onClick={() => setHeroText('I GOT THE CARD')}>I GOT THE CARD</PresetButton>
                        </div>
                        <Field label={`Size (${heroScale.toFixed(2)}×)`}>
                            <input
                                type="range"
                                min={0.6}
                                max={1.6}
                                step={0.05}
                                value={heroScale}
                                onChange={(e) => setHeroScale(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <Field label={`Tilt (${heroTilt}°)`}>
                            <input
                                type="range"
                                min={-20}
                                max={20}
                                step={1}
                                value={heroTilt}
                                onChange={(e) => setHeroTilt(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                    </Section>

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
                        {username.length > 12 && (
                            <p className="text-[10px] font-bold leading-snug text-red">
                                ⚠️ Username &gt; 12 chars · production caps at 12. The @username pill shrinks
                                defensively, but check the input gate in your caller.
                            </p>
                        )}
                    </Section>

                    <Section title="Username pill">
                        <Field label="Background">
                            <div className="flex flex-wrap gap-2">
                                {(['white', 'pink', 'blue'] as const).map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setUnameBg(c)}
                                        className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold transition-colors ${
                                            unameBg === c
                                                ? 'bg-primary-1 text-n-1'
                                                : 'bg-white text-grey-1 hover:bg-grey-2'
                                        }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label={`"peanut.me/" size (${unamePrefix.toFixed(2)}× of handle)`}>
                            <input
                                type="range"
                                min={0.2}
                                max={0.7}
                                step={0.02}
                                value={unamePrefix}
                                onChange={(e) => setUnamePrefix(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <Field label={`Handle size (${unameScale.toFixed(2)}×)`}>
                            <input
                                type="range"
                                min={0.6}
                                max={1.5}
                                step={0.05}
                                value={unameScale}
                                onChange={(e) => setUnameScale(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                        <Field label={`Handle letter-spacing (${unameTracking.toFixed(3)}em)`}>
                            <input
                                type="range"
                                min={-0.06}
                                max={0.12}
                                step={0.005}
                                value={unameTracking}
                                onChange={(e) => setUnameTracking(Number(e.target.value))}
                                className="w-full"
                            />
                        </Field>
                    </Section>

                    <Section title={`Badges (${selectedBadges.size} selected)`}>
                        <div className="flex flex-wrap gap-2">
                            {ALL_CODES.map((code) => (
                                <button
                                    key={code}
                                    onClick={() => toggleBadge(code)}
                                    className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold transition-colors ${
                                        selectedBadges.has(code)
                                            ? 'bg-primary-1 text-n-1'
                                            : 'bg-white text-grey-1 hover:bg-grey-2'
                                    }`}
                                    title={code}
                                >
                                    {getBadgeDisplayName(code, code)}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <PresetButton onClick={() => setSelectedBadges(new Set())}>0 badges</PresetButton>
                            <PresetButton onClick={() => setSelectedBadges(new Set(['OG_2025_10_12']))}>
                                1 badge
                            </PresetButton>
                            <PresetButton
                                onClick={() =>
                                    setSelectedBadges(new Set(['OG_2025_10_12', 'DEVCONNECT_BA_2025', 'CARD_PIONEER']))
                                }
                            >
                                3
                            </PresetButton>
                            <PresetButton
                                onClick={() =>
                                    setSelectedBadges(
                                        new Set([
                                            'OG_2025_10_12',
                                            'DEVCONNECT_BA_2025',
                                            'CARD_PIONEER',
                                            'BETA_TESTER',
                                            'SUPPORT_SURVIVOR',
                                            'ARBIVERSE_DEVCONNECT_BA_2025',
                                            'NOT_SO_SHHHH',
                                            'CARD_FIRST_SWIPE',
                                            'DOUBLE_DIGITS',
                                            'VERIFIED',
                                            'CARD_SPENT_1K',
                                            'MINI_INFLUENCER',
                                        ])
                                    )
                                }
                            >
                                12
                            </PresetButton>
                            <PresetButton onClick={() => setSelectedBadges(new Set(ALL_CODES))}>
                                all {ALL_CODES.length}
                            </PresetButton>
                        </div>
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
                                onClick={() => {
                                    // Remounts ShareAssetD3 (key) → card face repaints; re-gate Save.
                                    setAssetReady(false)
                                    setSeedNonce((n) => n + 1)
                                }}
                            >
                                Reroll seed
                            </Button>
                            <Button
                                variant="stroke"
                                shadowSize="4"
                                className="flex-1"
                                onClick={() => {
                                    setAssetReady(false)
                                    setAnimate((a) => !a)
                                }}
                            >
                                {animate ? '✓ Animate' : 'Animate off'}
                            </Button>
                        </div>
                    </Section>

                    <Section title="Username length shortcuts">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <PresetButton onClick={() => setUsername('me')}>2-char user</PresetButton>
                            <PresetButton onClick={() => setUsername('twelvechars1')}>12 chars (max)</PresetButton>
                            <PresetButton onClick={() => setUsername('thisistwentyplus_chars')}>20+ chars</PresetButton>
                            <PresetButton onClick={() => setUsername('kkonrad')}>reset</PresetButton>
                        </div>
                    </Section>
                </aside>

                {/* ─── RIGHT: Preview ──────────────────────────────────── */}
                <main className="flex flex-1 flex-col gap-4">
                    <div className="flex items-center justify-between rounded-sm border border-n-1 bg-grey-3 p-2 text-xs">
                        <span className="font-mono">
                            {CANVAS_W} × {CANVAS_H} · scaled {(previewScale * 100).toFixed(0)}%
                        </span>
                        <span className="font-mono text-grey-1">seed: {seedOverride ?? username ?? 'anon'}</span>
                    </div>
                    <div
                        className="overflow-auto rounded-sm border-2 border-n-1 bg-background"
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
                                ref={assetRef}
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
                                    seedOverride={seedOverride}
                                    heroMessage={heroMessage}
                                    usernameStyle={usernameStyle}
                                    hideUsername={hideUsername}
                                    animate={animate}
                                    onReady={() => setAssetReady(true)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Faithful "in the share flow" strip — mirrors how the asset,
                        the anti-dox toggle, and the share buttons stack in
                        BadgeSkipCelebration / CardUnlockDrawer. */}
                    <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-sm border-2 border-dashed border-grey-1 bg-white p-4">
                        <div className="text-center text-[10px] font-bold uppercase tracking-wider text-grey-1">
                            ↑ asset · how it stacks in the real flow ↓
                        </div>
                        <Checkbox
                            className="self-center"
                            label="Hide username"
                            value={hideUsername}
                            onChange={(e) => setHideUsername(e.target.checked)}
                        />
                        <Button variant="purple" shadowSize="4" className="w-full">
                            Share
                        </Button>
                        <Button
                            data-testid="save-image"
                            variant="stroke"
                            className="w-full"
                            onClick={handleSave}
                            loading={saving}
                            disabled={!assetReady || saving}
                        >
                            Save image
                        </Button>
                    </div>

                    <div className="space-y-2 rounded-sm border border-n-1 bg-white p-4 text-xs">
                        <div className="font-bold uppercase tracking-wider text-grey-1">Resulting props</div>
                        <pre className="overflow-auto whitespace-pre-wrap font-mono text-[11px]">
                            {JSON.stringify(
                                {
                                    username,
                                    badges: badgesArray.map((b) => b.code),
                                    seedOverride,
                                    heroMessage,
                                    usernameStyle,
                                    hideUsername,
                                    animate,
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
        <section className="shadow-4 rounded-sm border-2 border-n-1 bg-white p-4">
            <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-grey-1">{title}</h2>
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
            className="rounded-full border border-n-1 bg-white px-2 py-1 text-xs font-bold transition-colors hover:bg-grey-2"
        >
            {children}
        </button>
    )
}
