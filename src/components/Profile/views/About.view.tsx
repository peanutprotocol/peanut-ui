'use client'

import Card from '@/components/Global/Card'
import DocsLink from '@/components/Global/DocsLink'
import NavHeader from '@/components/Global/NavHeader'
import NavigationArrow from '@/components/Global/NavigationArrow'
import { BetaUpdatesCard } from '@/components/Profile/components/BetaUpdatesCard'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

const cardPosition = (index: number, total: number) =>
    index === 0 ? ('first' as const) : index === total - 1 ? ('last' as const) : ('middle' as const)

const TAPS_TO_REVEAL_BETA = 5
const TAP_WINDOW_MS = 2_000

export const AboutView = ({ appVersion }: { appVersion: string }) => {
    const t = useTranslations('profile.about')
    /**
     * The one place every policy is reachable from inside the app, mirroring the
     * ReConsent registry and the landing footer. Document titles stay in English
     * on purpose: they are the legal names of the documents (same convention as
     * the re-consent modal); the target pages localize their own prose. The Terms
     * of Service title is the one exception (TASK-22146): it follows the app
     * language, and every language opens the same English document.
     */
    const policyLinks: ReadonlyArray<{ name: string; href: string }> = [
        { name: t('terms'), href: '/terms' },
        { name: 'Privacy Policy', href: '/privacy' },
        { name: 'Card Terms (U.S.)', href: '/card-terms-us' },
        { name: 'Card Terms (International)', href: '/card-terms-international' },
        { name: 'E-Sign Consent', href: '/card-esign' },
        { name: 'Account Opening Privacy Notice', href: '/card-privacy' },
        { name: 'Prohibited Activities Policy', href: '/card-prohibited-activities' },
        { name: 'Security Disclosure', href: '/en/help/security-disclosure' },
    ]
    const onBack = useSafeBack('/profile', { replace: true })
    // the bundled version is only the web value and the pre-bridge fallback
    const version = useAppVersion(appVersion)
    const [betaRevealed, setBetaRevealed] = useState(false)
    const taps = useRef(0)
    const tapWindow = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const onVersionTap = () => {
        clearTimeout(tapWindow.current)
        taps.current += 1
        if (taps.current >= TAPS_TO_REVEAL_BETA) {
            taps.current = 0
            setBetaRevealed(true)
            return
        }
        tapWindow.current = setTimeout(() => {
            taps.current = 0
        }, TAP_WINDOW_MS)
    }

    return (
        <div className="space-y-4 mb-6">
            <NavHeader title={t('title')} onPrev={onBack} />

            <p className="text-body-s">{t('intro')}</p>

            <div>
                <h1 className="mb-2 font-bold text-black">{t('policiesHeading')}</h1>
                {policyLinks.map((doc, index) => (
                    <Card key={doc.href} position={cardPosition(index, policyLinks.length)}>
                        <DocsLink href={doc.href} className="flex cursor-pointer justify-between py-1">
                            <span className="text-body-s text-black">{doc.name}</span>
                            <NavigationArrow size={24} className="fill-black" />
                        </DocsLink>
                    </Card>
                ))}
            </div>

            {betaRevealed && <BetaUpdatesCard />}

            {/* Five taps reveal the internal-testing channel switch. */}
            <p className="text-center text-body-xs text-foreground-secondary" onClick={onVersionTap}>
                {t('version', { version })}
            </p>
        </div>
    )
}
