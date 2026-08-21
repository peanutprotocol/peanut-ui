'use client'

import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { isBridgeSupportedCountry } from '@/utils/regions.utils'
import posthog from 'posthog-js'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

type ChecklistItemId = 'create-account' | 'add-money' | 'get-card' | 'first-payment'

interface ChecklistItem {
    id: ChecklistItemId
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
 * Renders nothing once every item is done — the carousel and the rest of home
 * take over from there.
 */
const GettingStartedChecklist = () => {
    const t = useTranslations('home.gettingStarted')
    const router = useRouter()
    const { user } = useAuth()
    const { setIsQRScannerOpen } = useModalsContext()
    const restrictions = useResidenceRestrictions()
    const { isEligible } = useCardInfo()
    const { overview } = useRainCardOverview()

    const milestone = user?.user?.activationMilestone ?? 'registered'
    const isVerified = milestone === 'verified' || milestone === 'funded' || milestone === 'activated'
    const isFunded = milestone === 'funded' || milestone === 'activated'
    const residenceIso2 = user?.residence?.verified ?? user?.residence?.declared ?? null
    const hasActiveCard = !!findActiveCard(overview)
    // While eligibility is loading (undefined) the slot shows the first-payment
    // step — always a valid action — and upgrades to the card once the server
    // confirms. Never show a card step the user might not be allowed to take.
    const cardAvailable = !restrictions.card && isEligible === true

    const addMoneyLabel = useMemo(() => {
        if (residenceIso2 === 'BR') return t('addMoneyPix')
        if (residenceIso2 === 'MX') return t('addMoneySpei')
        if (residenceIso2 === 'US') return t('addMoneyBank')
        if (residenceIso2 && isBridgeSupportedCountry(residenceIso2)) return t('addMoneySepa')
        return t('addMoney')
    }, [residenceIso2, t])

    const items: ChecklistItem[] = useMemo(() => {
        const tap = (id: ChecklistItemId, action: () => void) => () => {
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_ITEM_CLICKED, { item: id })
            action()
        }
        const thirdItem: ChecklistItem = cardAvailable
            ? {
                  id: 'get-card',
                  label: t('getCard'),
                  done: hasActiveCard,
                  onTap: tap('get-card', () => router.push('/card')),
              }
            : {
                  id: 'first-payment',
                  label: t('firstPayment'),
                  done: milestone === 'activated',
                  onTap: tap('first-payment', () => setIsQRScannerOpen(true)),
              }
        return [
            { id: 'create-account', label: t('createAccount'), sub: t('createAccountDone'), done: true },
            {
                id: 'add-money',
                label: addMoneyLabel,
                sub: !isVerified ? t('kycNote') : undefined,
                done: isFunded,
                onTap: tap('add-money', () => router.push('/add-money')),
            },
            thirdItem,
        ]
    }, [addMoneyLabel, cardAvailable, hasActiveCard, isFunded, isVerified, milestone, router, setIsQRScannerOpen, t])

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
        <div>
            <p className="mb-2 text-sm font-bold">{t('title')}</p>
            <Card position="single" className="overflow-hidden p-0">
                {items.map((item) => {
                    const tappable = !item.done && !!item.onTap
                    return (
                        <button
                            key={item.id}
                            type="button"
                            disabled={!tappable}
                            onClick={item.onTap}
                            className={twMerge(
                                'flex w-full items-center gap-3 border-t border-n-1 px-4 py-3 text-left first:border-t-0 dark:border-white',
                                !tappable && 'cursor-default'
                            )}
                        >
                            <span
                                className={twMerge(
                                    'flex size-5 shrink-0 items-center justify-center rounded-full border border-n-1',
                                    item.done && 'bg-green-1'
                                )}
                            >
                                {item.done && <Icon name="check" className="size-3" />}
                            </span>
                            <span className="min-w-0">
                                <span className={twMerge('block text-sm font-bold', item.done && 'text-grey-1')}>
                                    {item.label}
                                </span>
                                {((item.done && item.id === 'create-account') || (!item.done && item.sub)) && (
                                    <span className="block text-xs text-grey-1">{item.sub}</span>
                                )}
                            </span>
                            {tappable && <Icon name="chevron-down" className="ml-auto size-4 shrink-0 -rotate-90" />}
                        </button>
                    )
                })}
            </Card>
        </div>
    )
}

export default GettingStartedChecklist
