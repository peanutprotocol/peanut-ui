'use client'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import PeanutMascot from '@/components/Global/PeanutMascot'
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
import { type OnboardingState, canHideChecklist } from '@/utils/activation-step.utils'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
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
    /** always one line (copy sized for 320px), in every state, so every row is the same height */
    sub: string | null
    done: boolean
    /** open but nothing to do yet (ID check in review): "In review" on the subtitle line */
    inReview?: boolean
    /** the row holds its place while its content is unknown (card eligibility loading) */
    pending?: boolean
    onTap?: () => void
}

/** where the ID check starts, and where its status lives while in review */
const VERIFY_HREF = '/profile/accounts'

const FIRST_PAYMENT_BUBBLE = {
    card_qr: CONCEPT_ICONS.qrPay,
    card: CONCEPT_ICONS.card,
    qr: CONCEPT_ICONS.qrPay,
    pending: CONCEPT_ICONS.qrPay,
} as const

const FIRST_PAYMENT_NOTE_KEY = {
    card_qr: 'firstPaymentCardNote',
    card: 'firstPaymentCardOnlyNote',
    qr: 'firstPaymentQrNote',
} as const

/** once a card is issued or applied for, the row says to pay with it, not to get it */
const FIRST_PAYMENT_HELD_CARD_NOTE_KEY = {
    card_qr: 'firstPaymentHeldCardQrNote',
    card: 'firstPaymentHeldCardNote',
    qr: 'firstPaymentQrNote',
} as const

/** the pulse placeholder for a one-line subtitle (design.md skeleton recipe) */
const SubtitleSkeleton = () => (
    // the line box stays 20px, the text line's height, so the row does not jump
    <span aria-hidden className="flex h-5 items-center">
        <span className="h-3 w-32 animate-pulse rounded bg-foreground-primary/10" />
    </span>
)

/**
 * The Home onboarding checklist (TASK-23054), under a small "Welcome to
 * Peanut" card with the progress bar. It shows every open row and only the
 * latest done one. Rows: Create account ✓ · Verify
 * identity · Add money · First payment. Home shows it until every row
 * is done; the rules for each row live in resolveOnboarding. The payment row
 * appears only for a user who can make an activating spend (card or QR).
 *
 * Every open row stays tappable, in any order: money can arrive before the ID
 * check. Every row has the same ListItem border (Hugo, 2026-09-25): the next
 * step shows only by its order and its chevron.
 */
const GettingStartedChecklist = ({ onboarding, onHide }: { onboarding: OnboardingState; onHide?: () => void }) => {
    const t = useTranslations('home.gettingStarted')
    const router = useRouter()
    const [, setHomeDrawer] = useHomeDrawer()
    const { setIsQRScannerOpen } = useModalsContext()
    const restrictions = useResidenceRestrictions()
    const depositAccountsEnabled = useDepositAccountsEnabled()
    const [isChooserOpen, setIsChooserOpen] = useState(false)

    const { verify, addMoneyDone, firstPaymentDone, firstPaymentRoute } = onboarding

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
                sub:
                    verify === 'done'
                        ? t('verifyIdentityDone')
                        : verify === 'in_review'
                          ? t('inReview')
                          : t('verifyIdentityNote'),
                done: verify === 'done',
                inReview: verify === 'in_review',
                onTap: tap('verify-identity', () => router.push(VERIFY_HREF)),
            },
            {
                id: 'add-money',
                bubble: CONCEPT_ICONS.addMoney,
                label: t('addMoney'),
                // A residence no bank provider onboards drops the bank half
                // rather than offering a route that cannot deliver.
                sub: addMoneyDone
                    ? t('addMoneyDone')
                    : restrictions.banking
                      ? t('addMoneyRoutesNoBank')
                      : depositAccountsEnabled
                        ? t('addMoneyStandingAccounts')
                        : t('addMoneyRoutes'),
                done: addMoneyDone,
                onTap: tap('add-money', () => void setHomeDrawer('add')),
            },
        ]
        if (firstPaymentRoute === 'pending') {
            rows.push({
                id: 'first-payment',
                bubble: FIRST_PAYMENT_BUBBLE.pending,
                label: t('firstPayment'),
                sub: null,
                done: false,
                pending: true,
            })
        } else if (firstPaymentRoute !== 'none') {
            const route = firstPaymentRoute
            rows.push({
                id: 'first-payment',
                bubble: FIRST_PAYMENT_BUBBLE[route],
                label: t('firstPayment'),
                sub: t((onboarding.cardHeld ? FIRST_PAYMENT_HELD_CARD_NOTE_KEY : FIRST_PAYMENT_NOTE_KEY)[route]),
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
        onboarding.cardHeld,
        addMoneyDone,
        depositAccountsEnabled,
        firstPaymentDone,
        firstPaymentRoute,
        restrictions.banking,
        router,
        setHomeDrawer,
        setIsQRScannerOpen,
        t,
        verify,
    ])

    // the bar and the count cover every row; the list shows every open row and
    // only the latest done one, so finished steps do not crowd out what is next
    const doneCount = items.filter((item) => item.done).length
    const completionPercent = Math.round((doneCount / items.length) * 100)
    const latestDoneId = items.filter((item) => item.done).at(-1)?.id
    const visibleItems = items.filter((item) => !item.done || item.id === latestDoneId)

    const viewedRef = useRef(false)
    useEffect(() => {
        if (!viewedRef.current) {
            viewedRef.current = true
            posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_VIEWED, { first_payment_route: firstPaymentRoute })
        }
    }, [firstPaymentRoute])

    return (
        <Section>
            {/* one height at every width: a one-line subtitle (wide screens) gets the
                same card as a two-line one; 320 may grow when the title wraps */}
            <Card
                position="solo"
                className="flex min-h-[90px] flex-col justify-center px-4 py-2"
                data-testid="onboarding-welcome"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        {/* es writes "Bienvenid@", which screen readers read as "arroba":
                            the visible title is hidden from them and a spoken form is read instead */}
                        <span className="text-heading-card text-foreground-primary">
                            <span aria-hidden>{t('welcomeTitle')}</span>
                            <span className="sr-only">{t('welcomeTitleSpoken')}</span>
                        </span>
                        <span className="text-body-s text-foreground-secondary">
                            {t('welcomeBody', { count: items.length })}
                        </span>
                    </div>
                    {/* the waving mascot on a soft badge-accent circle (Hugo's pick, 2026-09-25);
                        PeanutMascot shows a still frame under reduced motion */}
                    <div className="relative size-[72px] shrink-0">
                        <span aria-hidden className="absolute inset-1 rounded-full bg-background-badge-accent" />
                        <PeanutMascot pose="waving-hello" alt="" className="relative size-full" />
                    </div>
                </div>
            </Card>
            <div className="flex flex-col gap-1">
                <span className="text-body-s text-foreground-secondary">
                    {t('progress', { done: doneCount, total: items.length })}
                </span>
                <ProgressBar value={completionPercent} fillClassName="bg-background-icon-bubble-green" />
            </div>
            <ListGroup className="bg-background-default">
                {visibleItems.map((item) => {
                    const tappable = !item.done && !!item.onTap
                    return (
                        <ListItem
                            key={item.id}
                            data-testid={`checklist-${item.id}`}
                            leading={<IconBubble {...item.bubble} size="xs" />}
                            title={item.label}
                            truncate
                            // one line in every state: done, open, in review and pending
                            // rows share one height (Hugo, 2026-09-25)
                            body={item.pending ? <SubtitleSkeleton /> : item.sub}
                            // icon chips, not text pills: the status word is on the
                            // subtitle line, and a pill would push it past one line at 320px
                            trailing={
                                item.done ? (
                                    <Badge status="completed" type="icon" />
                                ) : item.inReview ? (
                                    <Badge status="processing" type="icon" />
                                ) : undefined
                            }
                            chevron={tappable}
                            onClick={tappable ? item.onTap : undefined}
                        />
                    )
                })}
            </ListGroup>
            {onHide && canHideChecklist(onboarding) && (
                // tertiary dismiss (design.md), only once the payment row is the one
                // left, so nobody hides the list before money is in. mt-4 on the
                // section's gap-2 keeps the 24px the hit area needs under a row
                <LinkButton
                    onClick={() => {
                        posthog.capture(ANALYTICS_EVENTS.HOME_CHECKLIST_HIDDEN, {
                            first_payment_route: firstPaymentRoute,
                        })
                        onHide()
                    }}
                    className="mt-4 self-center text-body-s text-foreground-primary"
                >
                    {t('hide')}
                </LinkButton>
            )}
            {firstPaymentRoute === 'card_qr' && (
                <FirstPaymentChooser open={isChooserOpen} onClose={() => setIsChooserOpen(false)} />
            )}
        </Section>
    )
}

export default GettingStartedChecklist
