'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import NavHeader from '@/components/Global/NavHeader'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useContacts } from '@/hooks/useContacts'
import { impactHaptic } from '@/utils/haptics'
import { sendUrl } from '@/utils/native-routes'
import { InstantCamera } from './InstantCamera'
import { ShakePhoto } from './ShakePhoto'
import type { ShakeCandidate } from './shakeApi'
import styles from './ShakeToPay.module.css'
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
    const slotRef = useRef<SVGRectElement>(null)

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

    const count = candidates.length
    const looking = state === 'searching' || (state === 'idle' && entryPending)
    const ready = state === 'idle' && !entryPending
    const ended = state === 'no-match' || state === 'expired' || state === 'error' || state === 'rate-limited'
    const showPeople = (state === 'searching' || state === 'done') && count > 0

    const heading = (() => {
        if (looking) {
            return count === 0
                ? { title: t('searching'), description: t('empty') }
                : { title: t('foundSearching', { count }), description: t('confirmRecipient') }
        }
        switch (state) {
            case 'done':
                return { title: t('nearbyCount', { count }), description: t('confirmRecipient') }
            case 'no-match':
                return { title: t('noMatchTitle'), description: t('noMatch') }
            case 'expired':
                return { title: t('expiredTitle'), description: t('expired') }
            case 'error':
                return { title: t('errorTitle'), description: t('error') }
            case 'rate-limited':
                return {
                    title: t('rateLimitedTitle'),
                    description: t('rateLimited', { seconds: retryAfterSeconds ?? 60 }),
                }
            default:
                return { title: t('instructions'), description: undefined }
        }
    })()

    const hints = [
        motionStatus === 'denied' && t('motionDenied'),
        motionStatus === 'unsupported' && t('motionUnavailable'),
        (locationStatus === 'denied' || locationStatus === 'unavailable') && t('locationHint'),
    ].filter((hint): hint is string => !!hint)

    return (
        <div className="isolate flex min-h-inherit flex-col gap-3">
            <NavHeader title={t('title')} onPrev={handleBack} />

            <div className={`${styles.stage} -mx-4 min-h-96 flex-1`}>
                <div className={styles.rippleClip} aria-hidden>
                    <div className={looking ? styles.ripples : `${styles.ripples} ${styles.ripplesIdle}`}>
                        {Array.from({ length: 6 }, (_, ring) => (
                            <span key={ring} className={styles.ring} />
                        ))}
                    </div>
                </div>
                {/* re-keyed per print so the shutter click replays */}
                <div key={count} className={count > 0 ? `${styles.camera} ${styles.cameraClick}` : styles.camera}>
                    <InstantCamera title={t('illustrationAlt')} searching={looking} muted={ended} slotRef={slotRef} />
                </div>
                <div className={styles.photos}>
                    {showPeople ? (
                        <ul className={styles.grid}>
                            {candidates.map((candidate, index) => (
                                <ShakePhoto
                                    key={candidate.username}
                                    candidate={candidate}
                                    index={index}
                                    isContact={contactUsernames.has(candidate.username.toLowerCase())}
                                    slotRef={slotRef}
                                    labels={{
                                        pay: candidate.displayName
                                            ? t('payNamedAria', {
                                                  name: candidate.displayName,
                                                  username: candidate.username,
                                              })
                                            : t('payAria', { name: `@${candidate.username}` }),
                                        contact: t('contact'),
                                        verified: t('verified'),
                                    }}
                                    onSelect={() => handleSelect(candidate, index)}
                                />
                            ))}
                        </ul>
                    ) : (
                        (state === 'no-match' || state === 'expired') && (
                            <div className={`${styles.photo} ${styles.blankPhoto}`}>
                                <span className={`${styles.shot} ${styles.blankShot} text-heading-s`} aria-hidden>
                                    {'?'}
                                </span>
                                <span className={`${styles.caption} text-label-m text-foreground-secondary`}>
                                    {t('nobodyYet')}
                                </span>
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <TitleBlock
                    align="center"
                    size="s"
                    title={heading.title}
                    description={heading.description}
                    aria-live="polite"
                />
                <div className="flex flex-col gap-4">
                    {(ended || ready) && (
                        <Button variant="primary" onClick={() => search('tap')}>
                            {ready ? t('tapToFind') : t('shakeAgain')}
                        </Button>
                    )}
                    <div className="flex flex-col items-center gap-8">
                        {looking && count === 0 && <LinkButton onClick={handleBack}>{t('cancel')}</LinkButton>}
                        {showPeople && <LinkButton onClick={() => search('tap')}>{t('notHere')}</LinkButton>}
                        {motionStatus === 'needs-permission' && (
                            <LinkButton onClick={() => void requestPermission()}>{t('startShaking')}</LinkButton>
                        )}
                    </div>
                    {hints.map((hint) => (
                        <p key={hint} className="text-center text-body-xs text-foreground-secondary">
                            {hint}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    )
}
