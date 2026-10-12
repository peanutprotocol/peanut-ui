'use client'

import { Component, Suspense, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useAttention } from './AttentionProvider'
import { ZONE_SURFACES } from './zoneSurfaces'
import type { AskId } from './types'

/**
 * Home's one attention component: the to-do list until the first payment,
 * then the next-best action with rotation (decide.ts). While the to-do list
 * shows, only a more critical ask may replace it; the list comes back once
 * that ask is dealt with.
 */
export function HomeAttention() {
    const t = useTranslations('home.attention')
    const { decision, state, openedZone, crashed, acted, dismissed, snoozed } = useAttention()
    const pick = decision.zone
    const id = pick?.id ?? null
    const Surface = id ? ZONE_SURFACES[id] : undefined

    const warnedFor = useRef<AskId | null>(null)
    useEffect(() => {
        if (!id || Surface || warnedFor.current === id) return
        warnedFor.current = id
        Sentry.captureMessage(`attention: no zone surface registered for ${id}`, {
            level: 'error',
            tags: { feature: 'attention' },
        })
    }, [id, Surface])

    useEffect(() => {
        if (id && Surface) openedZone(id)
    }, [id, Surface, openedZone])

    if (!id || !Surface || !pick) return null
    return (
        <section aria-label={t('label')} data-testid="home-attention" className="flex flex-col gap-2">
            <ZoneBoundary key={`${state.userId}:${id}`} askId={id} onCrash={() => crashed(id, 'zone')}>
                <Suspense fallback={null}>
                    <Surface
                        askId={id}
                        mode={pick.mode}
                        onActed={() => acted(id, 'zone')}
                        onDismissed={() => dismissed(id, 'zone')}
                        onSnoozed={(until) => snoozed(id, until, 'zone')}
                    />
                </Suspense>
            </ZoneBoundary>
        </section>
    )
}

export const AttentionZone = HomeAttention

/** A card that throws is settled as dismissed, so the next candidate takes the zone. */
class ZoneBoundary extends Component<{ askId: AskId; onCrash: () => void; children: ReactNode }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        Sentry.captureException(error, {
            tags: { feature: 'attention', ask: this.props.askId },
            extra: { componentStack: info.componentStack },
        })
        this.props.onCrash()
    }
    render() {
        return this.state.failed ? null : this.props.children
    }
}
