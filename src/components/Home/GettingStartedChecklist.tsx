'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { Section } from '@/components/0_Bruddle/Section'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import Badge from '@/components/Global/Badges/Badge'
import { type IconName } from '@/components/Global/Icons/Icon'
import FirstPaymentChooser from '@/components/Home/FirstPaymentChooser'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useModalsContext } from '@/context/ModalsContext'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useResidenceRestrictions } from '@/hooks/useResidenceRestrictions'
import { useHomeDrawer } from '@/features/home/useHomeDrawer'
import { type OnboardingState } from '@/utils/activation-step.utils'
import posthog from 'posthog-js'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

type ChecklistItemId = 'create-account' | 'verify-identity' | 'add-money' | 'first-payment'

interface ChecklistItem {
    id: ChecklistItemId
    /** a product concept's item spreads CONCEPT_ICONS; the account step is Peanut's own (yellow) */
    bubble: { icon: IconName | React.ReactElement; color: IconBubbleColor }
    label: string
    sub?: string
    done: boolean
    /** open but nothing to do yet (ID check in review): a pill instead of a subtitle */
    inReview?: boolean
    onTap?: () => void
}

/** where the ID check starts, and where its status lives while in review */
const VERIFY_HREF = '/profile/accounts-and-payments'

const FIRST_PAYMENT_BUBBLE = {
    card_qr: CONCEPT_ICONS.card,
    card: CONCEPT_ICONS.card,
    qr: CONCEPT_ICONS.qrPay,
} as const

const FIRST_PAYMENT_NOTE_KEY = {
    card_qr: 'firstPaymentCardNote',
    card: 'firstPaymentCardOnlyNote',
    qr: 'firstPaymentQrNote',
} as const

/**
 * The Home onboarding checklist (TASK-23054): Create account ✓ · Verify
 * identity · Add money · Make the first payment. Home shows it until every row
 * is done; the rules for each row live in resolveOnboarding. The payment row
 * appears only for a user who can make an activating spend (card or QR).
 *
 * Every open row stays tappable, in any order: money can arrive before the ID
 * check. The first open row that has something to do is outlined in pink —
 * a row in review is skipped, because there is nothing to do on it.
 */
const GettingStartedChecklist = ({ onboarding }: { onboarding: OnboardingState }) => {
    const t = useTranslations('home.gettingStarted')
    const router = useRouter()
    const [, setHomeDrawer] = useHomeDrawer()
    const { setIsQRScannerOpen } = useModalsContext()
    const restrictions = useResidenceRestrictions()
    const depositAccountsEnabled = useDepositAccountsEnabled()
    const [isChooserOpen, setIsChooserOpen] = useState(false)

    const { verify, addMoneyDone, firstPaymentDone, firstPaymentRoute } = onboarding
    const isVerified = verify === 'done'

    const items: ChecklistItem[] = useMemo(() => {
        const tap = (id: ChecklistItemId, action: () => void) => () => {
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_ITEM_CLICKED, { item: id })
            action()
        }
        const rows: ChecklistItem[] = [
            {
                id: 'create-account',
                bubble: { icon: 'user-plus', color: 'yellow' },
                label: t('createAccount'),
                sub: t('createAccountDone'),
                done: true,
            },
            {
                id: 'verify-identity',
                bubble: CONCEPT_ICONS.verification,
                label: t('verifyIdentity'),
                sub: t('verifyIdentityNote'),
                done: verify === 'done',
                inReview: verify === 'in_review',
                onTap: tap('verify-identity', () => router.push(VERIFY_HREF)),
            },
            {
                id: 'add-money',
                bubble: CONCEPT_ICONS.addMoney,
                label: t('addMoney'),
                // A residence no bank provider onboards drops the bank half
                // rather than selling an ID check that cannot deliver it.
                sub: restrictions.banking
                    ? t('addMoneyRoutesNoBank')
                    : depositAccountsEnabled
                      ? t('addMoneyStandingAccounts')
                      : isVerified
                        ? t('addMoneyRoutes')
                        : t('addMoneyRoutesKyc'),
                done: addMoneyDone,
                onTap: tap('add-money', () => void setHomeDrawer('add')),
            },
        ]
        if (firstPaymentRoute !== 'none') {
            const route = firstPaymentRoute
            rows.push({
                id: 'first-payment',
                bubble: FIRST_PAYMENT_BUBBLE[route],
                label: t('firstPayment'),
                sub: t(FIRST_PAYMENT_NOTE_KEY[route]),
                done: firstPaymentDone,
                onTap: tap('first-payment', () => {
                    if (route === 'card_qr') setIsChooserOpen(true)
                    else if (route === 'card') router.push('/card')
                    else setIsQRScannerOpen(true)
                }),
            })
        }
        return rows
    }, [
        addMoneyDone,
        depositAccountsEnabled,
        firstPaymentDone,
        firstPaymentRoute,
        isVerified,
        restrictions.banking,
        router,
        setHomeDrawer,
        setIsQRScannerOpen,
        t,
        verify,
    ])

    const completionPercent = Math.round((items.filter((item) => item.done).length / items.length) * 100)
    const nextId = items.find((item) => !item.done && !item.inReview)?.id

    const viewedRef = useRef(false)
    useEffect(() => {
        if (!viewedRef.current) {
            viewedRef.current = true
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_VIEWED, { first_payment_route: firstPaymentRoute })
        }
    }, [firstPaymentRoute])

    return (
        <Section>
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-body-s text-foreground-secondary">
                    <span>{t('title')}</span>
                    <span>{completionPercent}%</span>
                </div>
                <ProgressBar value={completionPercent} fillClassName="bg-background-icon-bubble-green" />
            </div>
            <ListGroup className="bg-background-default">
                {items.map((item) => {
                    const tappable = !item.done && !!item.onTap
                    const isNext = item.id === nextId
                    const showSub = (item.done && item.id === 'create-account') || (!item.done && !item.inReview)
                    return (
                        <ListItem
                            key={item.id}
                            data-testid={`checklist-${item.id}`}
                            leading={<IconBubble {...item.bubble} size="xs" />}
                            title={item.label}
                            body={showSub ? item.sub : undefined}
                            trailing={
                                item.done ? (
                                    <Badge status="completed" />
                                ) : item.inReview ? (
                                    <Badge status="processing" customText={t('inReview')} />
                                ) : undefined
                            }
                            bodyWrap
                            chevron={tappable}
                            // a done row is finished, not unavailable: it renders as a plain,
                            // untappable row instead of a disabled one
                            onClick={tappable ? item.onTap : undefined}
                            className={isNext ? 'outline-2 -outline-offset-2 outline-action-primary' : undefined}
                        />
                    )
                })}
            </ListGroup>
            {firstPaymentRoute === 'card_qr' && (
                <FirstPaymentChooser open={isChooserOpen} onClose={() => setIsChooserOpen(false)} />
            )}
        </Section>
    )
}

export default GettingStartedChecklist
