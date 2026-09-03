'use client'

import Card from '@/components/Global/Card'
import DocsLink from '@/components/Global/DocsLink'
import NavHeader from '@/components/Global/NavHeader'
import NavigationArrow from '@/components/Global/NavigationArrow'
import { BetaUpdatesCard, useBetaUpdatesAccess } from '@/components/Profile/components/BetaUpdatesCard'
import { useToast } from '@/components/0_Bruddle/Toast'
import { LEGAL_POLICIES } from '@/constants/legal-policies'
import { useAuth } from '@/context/authContext'
import { claimPeanutTeamBadge } from '@/services/peanut-team-badge'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

const cardPosition = (index: number, total: number) =>
    index === 0 ? ('first' as const) : index === total - 1 ? ('last' as const) : ('middle' as const)

const TAPS_TO_REVEAL_BETA = 5
const TAP_WINDOW_MS = 2_000

export const AboutView = ({ appVersion }: { appVersion: string }) => {
    const t = useTranslations('profile.about')
    const onBack = useSafeBack('/profile', { replace: true })
    // the bundled version is only the web value and the pre-bridge fallback
    const version = useAppVersion(appVersion)
    const [betaRevealed, setBetaRevealed] = useState(false)
    const taps = useRef(0)
    const tapWindow = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const toast = useToast()
    const betaAccess = useBetaUpdatesAccess()
    const betaCardRef = useRef<HTMLDivElement>(null)
    const { fetchUser } = useAuth()

    useEffect(() => {
        if (betaRevealed) betaCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
    }, [betaRevealed])

    /**
     * The tap is what earns PEANUT_TEAM, and the badge is what the switch reads
     * as permission to join. Claim and refetch BEFORE revealing: the card asks
     * the user object for the badge, so revealing first would show a disabled
     * toggle and an "ask for access" line for a round trip, on the very gesture
     * that just granted it.
     *
     * The toast fires first so the gesture is acknowledged immediately, and a
     * failed claim still reveals the card — the off switch has to stay
     * reachable for a device already on beta, whatever the network did.
     */
    const revealBetaCard = async () => {
        toast.info(t('beta.revealed'))
        if (await claimPeanutTeamBadge()) await fetchUser()
        setBetaRevealed(true)
    }

    // The fifth tap always answers: the card renders nothing on the web, and a
    // silent gesture reads as a broken one.
    const onVersionTap = () => {
        clearTimeout(tapWindow.current)
        taps.current += 1
        if (taps.current >= TAPS_TO_REVEAL_BETA) {
            taps.current = 0
            if (!betaAccess.supported) toast.info(t('beta.appOnly'))
            else void revealBetaCard()
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
                {LEGAL_POLICIES.map((doc, index) => (
                    <Card key={doc.href} position={cardPosition(index, LEGAL_POLICIES.length)}>
                        <DocsLink href={doc.href} className="flex cursor-pointer justify-between py-1">
                            <span className="text-body-s text-black">{t(`policies.${doc.key}`)}</span>
                            <NavigationArrow size={24} className="fill-black" />
                        </DocsLink>
                    </Card>
                ))}
            </div>

            {betaRevealed && (
                <div ref={betaCardRef}>
                    <BetaUpdatesCard />
                </div>
            )}

            {/* Five taps reveal the internal-testing channel switch. */}
            <p className="text-center text-body-xs text-foreground-secondary" onClick={onVersionTap}>
                {t('version', { version })}
            </p>
        </div>
    )
}
