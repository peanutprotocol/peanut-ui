'use client'

/**
 * /dev/ens-share — iterator for the ENS-reveal share asset.
 *
 * Sibling of /dev/share-builder, minimal on purpose: username + badge count
 * + seed reroll + save. The asset itself is <EnsAssetD3 /> — same machinery
 * as the card share asset (placeStamps, pill construction, capture).
 */

import { useMemo, useRef, useState } from 'react'
import EnsAssetD3 from '@/components/Card/share-asset/EnsAssetD3'
import { captureShareAsset, downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import { CANVAS_W, CANVAS_H } from '@/components/Card/share-asset/shareAssetLayout'
import { BADGE_CODES } from '@/components/Badges/badge.utils'

export default function EnsShareDevPage() {
    const [username, setUsername] = useState('yourname')
    const [badgeCount, setBadgeCount] = useState(6)
    const [seedNonce, setSeedNonce] = useState(0)
    const [previewScale, setPreviewScale] = useState(0.7)
    const [saving, setSaving] = useState(false)

    const assetRef = useRef<HTMLDivElement>(null)

    const badges = useMemo(
        () =>
            BADGE_CODES.slice(0, badgeCount).map((code, i) => ({
                code,
                earnedAt: new Date(2024 + (i % 3), i % 12, 1).toISOString(),
            })),
        [badgeCount]
    )

    const handleSave = async () => {
        const node = assetRef.current
        if (!node) return
        setSaving(true)
        try {
            const blob = await captureShareAsset(node)
            downloadBlob(blob, 'peanut-ens-name.png')
        } catch (err) {
            console.error('[ens-share] save failed', err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                    username
                    <input
                        className="rounded-sm border border-n-1 px-2 py-1"
                        value={username}
                        maxLength={20}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    />
                </label>
                <label className="flex items-center gap-2">
                    badges {badgeCount}
                    <input
                        type="range"
                        min={0}
                        max={12}
                        value={badgeCount}
                        onChange={(e) => setBadgeCount(Number(e.target.value))}
                    />
                </label>
                <label className="flex items-center gap-2">
                    scale {previewScale.toFixed(2)}
                    <input
                        type="range"
                        min={0.3}
                        max={1}
                        step={0.05}
                        value={previewScale}
                        onChange={(e) => setPreviewScale(Number(e.target.value))}
                    />
                </label>
                <button
                    className="rounded-sm border-2 border-n-1 bg-white px-3 py-1 font-bold"
                    onClick={() => setSeedNonce((n) => n + 1)}
                >
                    Reroll seed
                </button>
                <button
                    data-testid="save-image"
                    className="rounded-sm border-2 border-n-1 bg-primary-1 px-3 py-1 font-bold"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving…' : 'Save image'}
                </button>
            </div>

            <div className="overflow-auto rounded-sm border-2 border-n-1" style={{ minHeight: 200 }}>
                <div style={{ width: CANVAS_W * previewScale, height: CANVAS_H * previewScale, position: 'relative' }}>
                    <div
                        ref={assetRef}
                        style={{
                            width: CANVAS_W,
                            height: CANVAS_H,
                            transform: `scale(${previewScale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                        <EnsAssetD3
                            key={seedNonce}
                            username={username || 'anon'}
                            badges={badges}
                            seedOverride={seedNonce > 0 ? `${username}::${seedNonce}` : undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
