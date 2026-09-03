'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import StatusPill from '@/components/Global/StatusPill'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import posthog from 'posthog-js'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'

type ChecklistItemId = 'create-account' | 'add-money' | 'get-card' | 'first-payment'

interface ChecklistItem {
    id: ChecklistItemId
    label: string
    sub?: string
    done: boolean
    onTap?: () => void
}

// The undone marker: same 20px circle StatusPill draws for "completed",
// outlined and empty. No status token means "not yet", so it stays local.
const PendingMarker = () => (
    <span aria-hidden className="flex size-5 shrink-0 rounded-full border border-border-default" />
)

/**
 * The home getting-started checklist: exactly three items, mirroring the
 * Unlock payments screen's status language so home and profile tell one story.
 *
 *   1. Create your account — always done (progress the user can feel)
 *   2. Add money — label follows residence (PIX in Brazil, SEPA in Europe…);
 *      while unverified the subtitle carries the honest KYC cost, and the tap
 *      leads into add-money where verification triggers contextually
 *   3. Get the card when the residence is eligible; otherwise the slot goes to
 *      the first payment, so no one sees a dangling card step
 *
 * Renders nothing once every item is done — the carousel and the rest of home
 * take over from there.
 */
const GettingStartedChecklist = () => {
    const t = useTranslations('home.gettingStarted')
    const router = useRouter()
    const { user } = useAuth()
    const restrictions = useResidenceRestrictions()
    const { isEligible } = useCardInfo()
    const { overview } = useRainCardOverview()

    const milestone = user?.user?.activationMilestone ?? 'registered'
    const hasSentPayment = !!user?.user?.firstPaymentAt
    const isVerified = milestone === 'verified' || milestone === 'funded' || milestone === 'activated'
    const isFunded = milestone === 'funded' || milestone === 'activated'
    const hasActiveCard = !!findActiveCard(overview)
    // While eligibility is loading (undefined) the slot shows the first-payment
    // step — always a valid action — and upgrades to the card once the server
    // confirms. Never show a card step the user might not be allowed to take.
    const cardAvailable = !restrictions.card && isEligible === true

    const items: ChecklistItem[] = useMemo(() => {
        const tap = (id: ChecklistItemId, action: () => void) => () => {
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_ITEM_CLICKED, { item: id })
            action()
        }
        const thirdItem: ChecklistItem = cardAvailable
            ? {
                  id: 'get-card',
                  label: t('getCard'),
                  sub: t('getCardNote'),
                  done: hasActiveCard,
                  onTap: tap('get-card', () => router.push('/card')),
              }
            : {
                  id: 'first-payment',
                  label: t('firstPayment'),
                  sub: t('firstPaymentNote'),
                  done: milestone === 'activated' || hasSentPayment,
                  onTap: tap('first-payment', () => router.push('/send')),
              }
        return [
            { id: 'create-account', label: t('createAccount'), sub: t('createAccountDone'), done: true },
            {
                id: 'add-money',
                // The row opens /add-money, which offers bank transfer AND
                // crypto — naming one rail promised a route the chooser doesn't
                // take you straight to. A residence no bank provider onboards
                // drops the bank half rather than selling an ID check that
                // cannot deliver it (same ruling as the signup residence step).
                label: t('addMoney'),
                sub: restrictions.banking
                    ? t('addMoneyRoutesNoBank')
                    : isVerified
                      ? t('addMoneyRoutes')
                      : t('addMoneyRoutesKyc'),
                done: isFunded,
                onTap: tap('add-money', () => router.push('/add-money')),
            },
            thirdItem,
        ]
    }, [cardAvailable, hasActiveCard, hasSentPayment, isFunded, isVerified, milestone, restrictions.banking, router, t])

    const allDone = items.every((item) => item.done)

    const viewedRef = useRef(false)
    useEffect(() => {
        if (!allDone && !viewedRef.current) {
            viewedRef.current = true
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_VIEWED, {
                third_item: items[2].id,
            })
        }
    }, [allDone, items])

    if (allDone) return null

    return (
        <Section title={t('title')}>
            <ListGroup>
                {items.map((item) => {
                    const tappable = !item.done && !!item.onTap
                    const showSub = (item.done && item.id === 'create-account') || (!item.done && !!item.sub)
                    return (
                        <ListItem
                            key={item.id}
                            data-testid={`checklist-${item.id}`}
                            leading={item.done ? <StatusPill status="completed" /> : <PendingMarker />}
                            title={item.label}
                            body={showSub ? item.sub : undefined}
                            chevron={tappable}
                            disabled={!tappable}
                            onClick={tappable ? item.onTap : undefined}
                        />
                    )
                })}
            </ListGroup>
        </Section>
    )
}

export default GettingStartedChecklist
