'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useContacts } from '@/hooks/useContacts'
import { impactHaptic } from '@/utils/haptics'
import { sendUrl } from '@/utils/native-routes'
import { NearbyPhoneIllustration } from './NearbyPhoneIllustration'
import type { ShakeCandidate } from './shakeApi'
import { useApproxLocation } from './useApproxLocation'
import { useShakeMotion } from './useShakeMotion'
import { useShakeSession } from './useShakeSession'

export function ShakeToPayView({ onPrev }: { onPrev: () => void }) {
    const t = useTranslations('send.shake')
    const router = useRouter()
    const { state, candidates, retryAfterSeconds, shake, stop } = useShakeSession()
    const { location, status: locationStatus } = useApproxLocation()
    const { contacts } = useContacts({ limit: 100 })
    const contactUsernames = useMemo(
        () => new Set((contacts ?? []).map((contact) => contact.username.toLowerCase())),
        [contacts]
    )

    const shakeCount = useRef(0)
    const matchedShake = useRef(0)

    const search = useCallback(
        (method: 'motion' | 'tap') => {
            shakeCount.current += 1
            if (method === 'motion') impactHaptic()
            posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_SHAKE, { method, has_location: location !== null })
            void shake(location)
        },
        [shake, location]
    )

    const { status: motionStatus, requestPermission } = useShakeMotion({ onShake: () => search('motion') })

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_OPENED)
    }, [])

    useEffect(() => {
        if (locationStatus === 'pending') return
        posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_PERMISSION, { kind: 'location', result: locationStatus })
    }, [locationStatus])

    useEffect(() => {
        if (motionStatus === 'needs-permission') return
        posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_PERMISSION, { kind: 'motion', result: motionStatus })
    }, [motionStatus])

    useEffect(() => {
        if (state !== 'searching' || candidates.length === 0 || matchedShake.current === shakeCount.current) return
        matchedShake.current = shakeCount.current
        posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_MATCHED, { count: candidates.length })
    }, [state, candidates.length])

    const handleBack = () => {
        stop()
        onPrev()
    }

    const handleSelect = (candidate: ShakeCandidate, rank: number) => {
        posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_SELECTED, {
            rank,
            candidate_count: candidates.length,
            is_contact: contactUsernames.has(candidate.username.toLowerCase()),
            is_verified: candidate.isVerified,
        })
        stop()
        router.push(sendUrl(candidate.username))
    }

    const statusLine = (() => {
        switch (state) {
            case 'searching':
                return (
                    <span className="flex items-center gap-2">
                        <Loading className="h-5 w-5" />
                        {t('searching')}
                    </span>
                )
            case 'expired':
                return t('expired')
            case 'error':
                return t('error')
            case 'rate-limited':
                return t('rateLimited', { seconds: retryAfterSeconds ?? 60 })
            default:
                return null
        }
    })()

    return (
        <PageStack gap="6" className="min-h-0 flex-1">
            <NavHeader title={t('title')} onPrev={handleBack} />

            <PageStack.Center className="my-0 flex-none gap-3">
                <p className="text-center text-body-m text-foreground-secondary">{t('instructions')}</p>
                <div className="flex justify-center px-4">
                    <NearbyPhoneIllustration title={t('illustrationAlt')} />
                </div>
                <div className="min-h-6 text-center text-body-s" aria-live="polite">
                    {statusLine}
                </div>
            </PageStack.Center>

            <div className="flex flex-col gap-3">
                {motionStatus === 'needs-permission' && (
                    <Button variant="primary" onClick={() => void requestPermission()}>
                        {t('startShaking')}
                    </Button>
                )}
                <Button variant="secondary" onClick={() => search('tap')}>
                    {t('tapToFind')}
                </Button>
                {motionStatus === 'denied' && (
                    <p className="text-center text-body-s text-foreground-secondary">{t('motionDenied')}</p>
                )}
                {(locationStatus === 'denied' || locationStatus === 'unavailable') && (
                    <p className="text-center text-body-s text-foreground-secondary">{t('locationHint')}</p>
                )}
            </div>

            {state === 'searching' && (
                <Section title={t('peopleNearby')}>
                    {candidates.length === 0 ? (
                        <p className="text-body-s text-foreground-secondary">{t('empty')}</p>
                    ) : (
                        <ListGroup>
                            {candidates.map((candidate, index) => {
                                const name = candidate.displayName ?? candidate.username
                                const isContact = contactUsernames.has(candidate.username.toLowerCase())
                                return (
                                    <ListItem
                                        key={candidate.username}
                                        aria-label={t('payAria', {
                                            name: candidate.displayName ?? `@${candidate.username}`,
                                        })}
                                        leading={
                                            <UserAvatar
                                                size="s"
                                                name={candidate.username}
                                                avatarKey={candidate.avatarKey}
                                                decorative
                                            />
                                        }
                                        title={
                                            <span className="flex min-w-0 items-center gap-1">
                                                <span className="truncate">{name}</span>
                                                {candidate.isVerified && (
                                                    <Icon
                                                        name="check"
                                                        size={16}
                                                        className="shrink-0 text-green-500"
                                                        aria-label={t('verified')}
                                                        role="img"
                                                    />
                                                )}
                                            </span>
                                        }
                                        body={`@${candidate.username}`}
                                        trailing={
                                            isContact ? (
                                                <span className="text-label-m text-foreground-secondary">
                                                    {t('contact')}
                                                </span>
                                            ) : undefined
                                        }
                                        chevron
                                        onClick={() => handleSelect(candidate, index)}
                                    />
                                )
                            })}
                        </ListGroup>
                    )}
                </Section>
            )}
        </PageStack>
    )
}
