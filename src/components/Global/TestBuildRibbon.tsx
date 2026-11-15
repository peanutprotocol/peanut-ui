'use client'

import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { MarqueeWrapper } from '@/components/Global/MarqueeWrapper'
import {
    getApiCompatibility,
    loadApiVersion,
    subscribeApiCompatibility,
    type ApiCompatibility,
} from '@/utils/api-contracts'

// h-7
const RIBBON_HEIGHT = '1.75rem'

/**
 * A build for testing (any branch but main, scripts/build-branch.cjs) says so
 * on every screen, under the status bar (Slava, 2026-10-26). It adds its height
 * to --safe-top, which every layout and fixed bar already insets by.
 */
export function TestBuildRibbon() {
    // inlined at build time, like every NEXT_PUBLIC_ value
    const branch = process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH || null
    const api = useSyncExternalStore(subscribeApiCompatibility, getApiCompatibility, getApiCompatibility)
    useEffect(() => {
        void loadApiVersion()
    }, [])
    useLayoutEffect(() => {
        if (!branch) return
        const root = document.documentElement.style
        root.setProperty('--safe-top', `calc(var(--safe-area-inset-top) + ${RIBBON_HEIGHT})`)
        return () => {
            root.removeProperty('--safe-top')
        }
    }, [branch])
    if (!branch) return null
    return <TestBuildRibbonView branch={branch} api={api} />
}

export function TestBuildRibbonView({ branch, api }: { branch: string; api: ApiCompatibility }) {
    const t = useTranslations('global')
    const failed = api.status === 'incompatible' || api.contractError
    const apiLabel = api.version
        ? `API ${api.version.commit?.slice(0, 7) ?? 'unknown'} · kyc v${api.version.contracts.kyc}`
        : api.status === 'loading'
          ? 'API version loading'
          : 'API version unavailable'
    return (
        <div
            role="note"
            className="pointer-events-none fixed inset-x-0 top-[var(--safe-area-inset-top)] z-[60] h-7"
            data-testid="test-build-ribbon"
        >
            <MarqueeWrapper
                backgroundColor={failed ? 'bg-red-600' : 'bg-background-brand'}
                className="flex h-full items-center border-b border-black"
            >
                <span className={`mx-4 text-label-m ${failed ? 'text-white' : 'text-foreground-primary'}`}>
                    {t('testBuild', { branch })} · {apiLabel}
                    {api.status === 'incompatible' && ' · API too old for this build'}
                    {api.contractError && ' · API contract error'}
                </span>
            </MarqueeWrapper>
        </div>
    )
}
