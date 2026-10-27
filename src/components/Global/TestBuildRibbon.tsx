'use client'

import { useLayoutEffect } from 'react'
import { useTranslations } from 'next-intl'
import { MarqueeWrapper } from '@/components/Global/MarqueeWrapper'

// h-7
const RIBBON_HEIGHT = '1.75rem'

/**
 * A build for testing (any branch but main, scripts/build-branch.cjs) says so
 * on every screen, under the status bar (Slava, 2026-10-26). It adds its height
 * to --safe-top, which every layout and fixed bar already insets by.
 */
export function TestBuildRibbon() {
    const t = useTranslations('global')
    // inlined at build time, like every NEXT_PUBLIC_ value
    const branch = process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH || null
    useLayoutEffect(() => {
        if (!branch) return
        const root = document.documentElement.style
        root.setProperty('--safe-top', `calc(var(--safe-area-inset-top) + ${RIBBON_HEIGHT})`)
        return () => {
            root.removeProperty('--safe-top')
        }
    }, [branch])
    if (!branch) return null
    return (
        <div
            role="note"
            className="pointer-events-none fixed inset-x-0 top-[var(--safe-area-inset-top)] z-[60] h-7"
            data-testid="test-build-ribbon"
        >
            <MarqueeWrapper
                backgroundColor="bg-background-brand"
                className="flex h-full items-center border-b border-black"
            >
                <span className="mx-4 text-label-m text-foreground-primary">{t('testBuild', { branch })}</span>
            </MarqueeWrapper>
        </div>
    )
}
