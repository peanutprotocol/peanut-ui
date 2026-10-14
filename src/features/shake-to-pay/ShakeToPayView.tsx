'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
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
    const [shook] = useQueryState('shook', parseAsString)
    const { contacts } = useContacts({ limit: 100 })
    const contactUsernames = useMemo(
        () => new Set((contacts ?? []).map((contact) => contact.username.toLowerCase())),
        [contacts]
    )

    const shakeCount = useRef(0)
    const matchedShake = useRef(0)
    const [entryPending, setEntryPending] = useState(true)
    const pendingEntry = useRef(true)
    const entryDeadline = useRef(Date.now() + 2000)
    const entryMethod = useRef<'entry' | 'home_shake'>(shook === '1' ? 'home_shake' : 'entry')
    const entryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const cancelEntry = useCallback(() => {
        pendingEntry.current = false
        if (entryTimer.current !== null) clearTimeout(entryTimer.current)
        entryTimer.current = null
        setEntryPending(false)
    }, [])

    const search = useCallback(
        (method: 'motion' | 'tap' | 'entry' | 'home_shake') => {
            cancelEntry()
            shakeCount.current += 1
            if (method === 'motion') impactHaptic()
            posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_SHAKE, { method, has_location: location !== null })
            void shake(location)
        },
        [shake, location, cancelEntry]
    )
    const latestSearch = useRef(search)
    latestSearch.current = search

    useEffect(() => {
        let active = true
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') cancelEntry()
        }
        const startEntry = () => {
            if (!active || !pendingEntry.current) return
            if (document.visibilityState === 'hidden') {
                cancelEntry()
                return
            }
            latestSearch.current(entryMethod.current)
        }
        document.addEventListener('visibilitychange', onVisibility)
        onVisibility()
        if (pendingEntry.current) {
            if (locationStatus !== 'pending') {
                // Defer until effect replay completes so StrictMode keeps the real create.
                void Promise.resolve().then(startEntry)
            } else {
                entryTimer.current = setTimeout(startEntry, Math.max(0, entryDeadline.current - Date.now()))
            }
        }
        return () => {
            active = false
            document.removeEventListener('visibilitychange', onVisibility)
            if (entryTimer.current !== null) clearTimeout(entryTimer.current)
            entryTimer.current = null
        }
    }, [locationStatus, cancelEntry])

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
        if (
            (state !== 'searching' && state !== 'done') ||
            candidates.length === 0 ||
            matchedShake.current === shakeCount.current
        )
            return
        matchedShake.current = shakeCount.current
        posthog.capture(ANALYTICS_EVENTS.SHAKE_TO_PAY_MATCHED, { count: candidates.length })
    }, [state, candidates.length])

    const handleBack = () => {
        cancelEntry()
        stop()
        onPrev()
    }

    const handleSelect = (candidate: ShakeCandidate, rank: number) => {
        cancelEntry()
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
        switch (state === 'idle' && entryPending ? 'searching' : state) {
            case 'searching':
                return (
                    <span className="flex items-center gap-2">
                        <Loading className="h-5 w-5" />
                        {t('searching')}
                    </span>
                )
            case 'expired':
                return t('expired')
            case 'no-match':
                return t('noMatch')
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
                {motionStatus === 'unsupported' && (
                    <p className="text-center text-body-s text-foreground-secondary">{t('motionUnavailable')}</p>
                )}
                {(locationStatus === 'denied' || locationStatus === 'unavailable') && (
                    <p className="text-center text-body-s text-foreground-secondary">{t('locationHint')}</p>
                )}
            </div>

            {(state === 'searching' || state === 'done') && (
                <Section title={t('peopleNearby')}>
                    {candidates.length === 0 ? (
                        <p className="text-body-s text-foreground-secondary">{t('empty')}</p>
                    ) : (
                        <>
                            <p className="text-body-s text-foreground-secondary">{t('confirmRecipient')}</p>
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
                        </>
                    )}
                </Section>
            )}
        </PageStack>
    )
}
