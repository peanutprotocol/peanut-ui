'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { isNativeHelpContext } from '@/utils/native-help-context'
import { useHydrationSnapshot } from '@/utils/native-platform'

/**
 * THE back affordance for marketing/content pages — the design-system
 * NavHeader circle button floated over the hero, as /shhhhh established
 * (ds-qa: it overlays instead of sitting in a bar because a bar added a
 * cream strip over the hero fold and pushed the wordmark down; absolute
 * costs no vertical space).
 *
 * When to use: any marketing surface that needs a way back. Never
 * hand-roll another back button (design.md → "navigation and back").
 *
 * No session gate, same as /shhhhh: visitors with in-app history (a
 * logged-in user who navigated here from the app) get router.back() to
 * where they came from; a cold deep-link visitor goes to `fallbackHref`.
 * The fallback stays a public route — pushing cold visitors into an
 * authed route bounces them to /setup.
 */
export function HeroBackNav({ fallbackHref = '/' }: { fallbackHref?: string }) {
    const onBack = useSafeBack(fallbackHref)
    // The app opens the Help Center in an in-app browser sheet. A page there
    // cannot close the sheet, and the fallback opened the landing page, which
    // looks like a logout (TASK-23926). The sheet's own controls go back or close.
    const inNativeHelpSheet = useHydrationSnapshot(isNativeHelpContext, () => false)

    return (
        <div className="absolute top-[calc(var(--safe-top)_+_1rem)] left-4 z-30">
            {/* no maintenance banner on marketing pages / shhhhh (ruled
                2026-09-03) — and a banner inside this absolute overlay would
                cover the hero anyway */}
            <NavHeader onPrev={onBack} hideLabel hideMaintenanceBanner hideBackBtn={inNativeHelpSheet} />
        </div>
    )
}
