'use client'

/**
 * Preview — renders the real <BadgeSkipCelebration /> in a phone frame with
 * mock data so we can eyeball the actual win-share screen (asset + "Hide
 * username" toggle + share buttons). Dev-only; not part of any PR.
 */

import BadgeSkipCelebration from '@/components/Card/BadgeSkipCelebration'

const MOCK_BADGES = [
    { code: 'OG_2025_10_12', earnedAt: '2025-10-12T00:00:00Z' },
    { code: 'DEVCONNECT_BA_2025', earnedAt: '2025-09-01T00:00:00Z' },
    { code: 'CARD_PIONEER', earnedAt: '2025-08-01T00:00:00Z' },
    { code: 'BETA_TESTER', earnedAt: '2025-07-01T00:00:00Z' },
    { code: 'SUPPORT_SURVIVOR', earnedAt: '2025-06-01T00:00:00Z' },
    { code: 'ARBIVERSE_DEVCONNECT_BA_2025', earnedAt: '2025-05-01T00:00:00Z' },
]

export default function CelebrationPreviewPage() {
    return (
        <div className="flex min-h-screen items-start justify-center bg-grey-3 p-6">
            <div
                className="shadow-4 w-full max-w-[392px] overflow-hidden rounded-[28px] border-2 border-n-1 bg-white"
                style={{ height: 820 }}
            >
                <div className="flex h-full flex-col px-5 py-4" style={{ minHeight: 760 }}>
                    <BadgeSkipCelebration
                        badgeCode="OG_2025_10_12"
                        username="kkonrad"
                        badges={MOCK_BADGES}
                        tier={0}
                        pointsBalance={0}
                        onContinue={() => {}}
                    />
                </div>
            </div>
        </div>
    )
}
