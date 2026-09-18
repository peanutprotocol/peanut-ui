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
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { Field } from '@/components/0_Bruddle/Field'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import ShareAssetD3 from '@/components/Card/share-asset/ShareAssetD3'
import type { HeroVariant, UsernameBg } from '@/components/Card/share-asset/shareAsset.types'
import { captureShareAsset, downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import { BADGE_CODES, getBadgeDisplayName } from '@/components/Badges/badge.utils'
import { CANVAS_W, CANVAS_H } from '@/components/Card/share-asset/shareAssetLayout'
import { Slider } from '@/components/Global/Slider'
import DevPageShell from '../_components/DevPageShell'

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
    // card face's hand <img> loads (ShareAssetD3.onReady) — Save is
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
        <DevPageShell
            title="Share asset builder"
            description="Iterate the card share asset (sticker collage) — badge set, username length, hero variant, seed reroll — and capture the PNG."
        >
            <div className="flex flex-col gap-8 lg:flex-row">
                {/* ─── LEFT: Controls ──────────────────────────────────── */}
                <aside className="flex flex-col gap-6 lg:w-[360px] lg:flex-shrink-0">
                    <Card className="p-4" shadowSize="4">
                        <Section title="Hero message (I got in)">
                            <Field label="Sticker type">
                                <Tabs
                                    value={heroVariant}
                                    onValueChange={(value) => setHeroVariant(value as HeroVariant | 'none')}
                                    tabs={(['none', 'burst', 'pill', 'banner'] as const).map((value) => ({
                                        value,
                                        label: value,
                                    }))}
                                    aria-label="Hero sticker type"
                                    fullWidth
                                />
                            </Field>
                            <Field label="Copy" htmlFor="share-hero-copy">
                                <BaseInput
                                    id="share-hero-copy"
                                    variant="sm"
                                    value={heroText}
                                    maxLength={28}
                                    onChange={(e) => setHeroText(e.target.value)}
                                    placeholder="I'M IN"
                                />
                            </Field>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="stroke" size="small" onClick={() => setHeroText("I'M IN")}>
                                    I&apos;M IN
                                </Button>
                                <Button variant="stroke" size="small" onClick={() => setHeroText("shhhh, i'm in")}>
                                    shhhh, i&apos;m in
                                </Button>
                                <Button variant="stroke" size="small" onClick={() => setHeroText('ACCESS GRANTED')}>
                                    ACCESS GRANTED
                                </Button>
                                <Button variant="stroke" size="small" onClick={() => setHeroText('I GOT THE CARD')}>
                                    I GOT THE CARD
                                </Button>
                            </div>
                            <Field label={`Size (${heroScale.toFixed(2)}×)`}>
                                <Slider
                                    min={0.6}
                                    max={1.6}
                                    step={0.05}
                                    value={[heroScale]}
                                    onValueChange={([value]) => setHeroScale(value)}
                                    aria-label="Hero sticker size"
                                />
                            </Field>
                            <Field label={`Tilt (${heroTilt}°)`}>
                                <Slider
                                    min={-20}
                                    max={20}
                                    step={1}
                                    value={[heroTilt]}
                                    onValueChange={([value]) => setHeroTilt(value)}
                                    aria-label="Hero sticker tilt"
                                />
                            </Field>
                        </Section>
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title="Identity">
                            <Field label={`Username (${username.length} / 12)`} htmlFor="share-username">
                                <BaseInput
                                    id="share-username"
                                    variant="sm"
                                    value={username}
                                    maxLength={20}
                                    onChange={(e) =>
                                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                                    }
                                    placeholder="kkonrad"
                                />
                            </Field>
                            {username.length > 12 && (
                                <Notification priority="error">
                                    Username exceeds the 12-character production limit. The preview shrinks it only to
                                    expose caller regressions.
                                </Notification>
                            )}
                        </Section>
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title="Username pill">
                            <Field label="Background">
                                <Tabs
                                    value={unameBg}
                                    onValueChange={(value) => setUnameBg(value as UsernameBg)}
                                    tabs={(['white', 'pink', 'blue'] as const).map((value) => ({
                                        value,
                                        label: value,
                                    }))}
                                    aria-label="Username pill background"
                                    fullWidth
                                />
                            </Field>
                            <Field label={`"peanut.me/" size (${unamePrefix.toFixed(2)}× of handle)`}>
                                <Slider
                                    min={0.2}
                                    max={0.7}
                                    step={0.02}
                                    value={[unamePrefix]}
                                    onValueChange={([value]) => setUnamePrefix(value)}
                                    aria-label="Username prefix size"
                                />
                            </Field>
                            <Field label={`Handle size (${unameScale.toFixed(2)}×)`}>
                                <Slider
                                    min={0.6}
                                    max={1.5}
                                    step={0.05}
                                    value={[unameScale]}
                                    onValueChange={([value]) => setUnameScale(value)}
                                    aria-label="Username handle size"
                                />
                            </Field>
                            <Field label={`Handle letter-spacing (${unameTracking.toFixed(3)}em)`}>
                                <Slider
                                    min={-0.06}
                                    max={0.12}
                                    step={0.005}
                                    value={[unameTracking]}
                                    onValueChange={([value]) => setUnameTracking(value)}
                                    aria-label="Username letter spacing"
                                />
                            </Field>
                        </Section>
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title={`Badges (${selectedBadges.size} selected)`}>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {ALL_CODES.map((code) => (
                                    <Checkbox
                                        key={code}
                                        label={getBadgeDisplayName(code, code)}
                                        value={selectedBadges.has(code)}
                                        onChange={() => toggleBadge(code)}
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="stroke" size="small" onClick={() => setSelectedBadges(new Set())}>
                                    0 badges
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() => setSelectedBadges(new Set(['OG_2025_10_12']))}
                                >
                                    1 badge
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() =>
                                        setSelectedBadges(
                                            new Set(['OG_2025_10_12', 'DEVCONNECT_BA_2025', 'CARD_PIONEER'])
                                        )
                                    }
                                >
                                    3
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
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
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() => setSelectedBadges(new Set(ALL_CODES))}
                                >
                                    all {ALL_CODES.length}
                                </Button>
                            </div>
                        </Section>
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title="Layout">
                            <Field label={`Preview scale (${previewScale.toFixed(2)}×)`}>
                                <Slider
                                    min={0.3}
                                    max={1}
                                    step={0.05}
                                    value={[previewScale]}
                                    onValueChange={([value]) => setPreviewScale(value)}
                                    aria-label="Preview scale"
                                />
                            </Field>
                            <div className="flex gap-2">
                                <Button
                                    variant="purple"
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
                    </Card>

                    <Card className="p-4" shadowSize="4">
                        <Section title="Username length shortcuts">
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="stroke" size="small" onClick={() => setUsername('me')}>
                                    2-char user
                                </Button>
                                <Button variant="stroke" size="small" onClick={() => setUsername('twelvechars1')}>
                                    12 chars (max)
                                </Button>
                                <Button
                                    variant="stroke"
                                    size="small"
                                    onClick={() => setUsername('thisistwentyplus_chars')}
                                >
                                    20+ chars
                                </Button>
                                <Button variant="stroke" size="small" onClick={() => setUsername('kkonrad')}>
                                    reset
                                </Button>
                            </div>
                        </Section>
                    </Card>
                </aside>

                {/* ─── RIGHT: Preview ──────────────────────────────────── */}
                <main className="flex flex-1 flex-col gap-4">
                    <div className="flex items-center justify-between rounded-sm border border-border-default bg-background-page p-2 text-body-xs">
                        <span className="font-mono">
                            {CANVAS_W} × {CANVAS_H} · scaled {(previewScale * 100).toFixed(0)}%
                        </span>
                        <span className="font-mono text-foreground-secondary">
                            seed: {seedOverride ?? username ?? 'anon'}
                        </span>
                    </div>
                    <div
                        className="overflow-auto rounded-sm border-2 border-border-default bg-background-default"
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
                    <Card className="mx-auto w-full max-w-md gap-3 border-dashed p-4">
                        <div className="text-center text-label-m text-foreground-secondary uppercase">
                            ↑ asset · how it stacks in the real flow ↓
                        </div>
                        <Checkbox
                            className="self-center"
                            label="Hide username"
                            value={hideUsername}
                            onChange={(e) => setHideUsername(e.target.checked)}
                        />
                        <Button variant="purple" className="w-full">
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
                    </Card>

                    <Card className="gap-2 p-4 text-body-xs">
                        <div className="text-label-m text-foreground-secondary uppercase">Resulting props</div>
                        <pre className="overflow-auto font-mono text-body-xs whitespace-pre-wrap">
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
                    </Card>
                </main>
            </div>
        </DevPageShell>
    )
}
