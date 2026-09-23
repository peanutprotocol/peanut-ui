'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { Section } from '@/components/0_Bruddle/Section'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import Badge from '@/components/Global/Badges/Badge'
import { type IconName } from '@/components/Global/Icons/Icon'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useHomeDrawer } from '@/features/home/useHomeDrawer'
import posthog from 'posthog-js'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'

type ChecklistItemId = 'create-account' | 'add-money' | 'get-card' | 'first-payment'

interface ChecklistItem {
    id: ChecklistItemId
    icon: IconName
    label: string
    sub?: string
    done: boolean
    onTap?: () => void
}

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
 * Home renders this checklist before funding; the parent owns funded and
 * activated states. Since account creation is already complete by the time
 * this surface appears, its reachable progress copy is the canonical
 * "Get started" label alongside the current percentage.
 */
const GettingStartedChecklist = () => {
    const t = useTranslations('home.gettingStarted')
    const router = useRouter()
    const [, setHomeDrawer] = useHomeDrawer()
    const { user } = useAuth()
    const restrictions = useResidenceRestrictions()
    const depositAccountsEnabled = useDepositAccountsEnabled()
    const { isEligible } = useCardInfo()
    const { overview } = useRainCardOverview()

    const milestone = user?.user?.activationMilestone ?? 'registered'
    const hasSentPayment = !!user?.user?.firstPaymentAt
    const isVerified = milestone === 'verified' || milestone === 'funded' || milestone === 'activated'
    const isFunded = milestone === 'funded' || milestone === 'activated'
    const hasActiveCard = !!findActiveCard(overview)
    // isEligible is undefined only for the initial no-data load and remains
    // stable from cached data during background refetches, so the third slot
    // does not flip between card and first-payment on focus or reconnect.
    const cardAvailable = !restrictions.card && isEligible === true

    const items: ChecklistItem[] = useMemo(() => {
        const tap = (id: ChecklistItemId, action: () => void) => () => {
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_ITEM_CLICKED, { item: id })
            action()
        }
        const thirdItem: ChecklistItem = cardAvailable
            ? {
                  id: 'get-card',
                  icon: 'credit-card',
                  label: t('getCard'),
                  sub: t('getCardNote'),
                  done: hasActiveCard,
                  onTap: tap('get-card', () => router.push('/card')),
              }
            : {
                  id: 'first-payment',
                  icon: 'arrow-up',
                  label: t('firstPayment'),
                  sub: t('firstPaymentNote'),
                  done: milestone === 'activated' || hasSentPayment,
                  onTap: tap('first-payment', () => router.push('/send')),
              }
        return [
            {
                id: 'create-account',
                icon: 'user-plus',
                label: t('createAccount'),
                sub: t('createAccountDone'),
                done: true,
            },
            {
                id: 'add-money',
                icon: 'arrow-down',
                // The Add drawer offers bank transfer AND
                // crypto — naming one rail promised a route the chooser doesn't
                // take you straight to. A residence no bank provider onboards
                // drops the bank half rather than selling an ID check that
                // cannot deliver it (same ruling as the signup residence step).
                label: t('addMoney'),
                // With standing accounts live, the step is a win rather than a
                // chore: bank details of the user's own, not an ID check to pay for.
                sub: restrictions.banking
                    ? t('addMoneyRoutesNoBank')
                    : depositAccountsEnabled
                      ? t('addMoneyStandingAccounts')
                      : isVerified
                        ? t('addMoneyRoutes')
                        : t('addMoneyRoutesKyc'),
                done: isFunded,
                onTap: tap('add-money', () => void setHomeDrawer('add')),
            },
            thirdItem,
        ]
    }, [
        cardAvailable,
        depositAccountsEnabled,
        hasActiveCard,
        hasSentPayment,
        isFunded,
        isVerified,
        milestone,
        restrictions.banking,
        router,
        setHomeDrawer,
        t,
    ])

    const completionPercent = Math.round((items.filter((item) => item.done).length / items.length) * 100)
    const progressLabel = t('title')

    const viewedRef = useRef(false)
    useEffect(() => {
        if (!viewedRef.current) {
            viewedRef.current = true
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_VIEWED, {
                third_item: items[2].id,
            })
        }
    }, [items])

    return (
        <Section>
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-body-s text-foreground-secondary">
                    <span>{progressLabel}</span>
                    <span>{completionPercent}%</span>
                </div>
                <ProgressBar value={completionPercent} fillClassName="bg-background-icon-bubble-green" />
            </div>
            <ListGroup className="bg-background-default">
                {items.map((item) => {
                    const tappable = !item.done && !!item.onTap
                    const showSub = (item.done && item.id === 'create-account') || (!item.done && !!item.sub)
                    return (
                        <ListItem
                            key={item.id}
                            data-testid={`checklist-${item.id}`}
                            leading={<IconBubble icon={item.icon} size="xs" color="yellow" />}
                            title={item.label}
                            body={showSub ? item.sub : undefined}
                            trailing={item.done ? <Badge status="completed" /> : undefined}
                            bodyWrap
                            chevron={tappable}
                            // a done row is finished, not unavailable: it renders as a plain,
                            // untappable row instead of a disabled one
                            disabled={!item.done && !tappable}
                            onClick={tappable ? item.onTap : undefined}
                        />
                    )
                })}
            </ListGroup>
        </Section>
    )
}

export default GettingStartedChecklist
