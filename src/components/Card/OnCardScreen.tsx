'use client'
import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal from '@/components/Global/ActionModal'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { useBalanceSplit } from '@/hooks/wallet/useBalanceSplit'
import { useMoveOffCard } from '@/hooks/wallet/useMoveOffCard'
import { EXCESS_COLLATERAL_MIN_CENTS } from '@/utils/balance.utils'

interface Props {
    cardId: string
    onPrev?: () => void
}

type Modal = 'target' | 'floor' | 'toCard' | 'offCard'

/** Bounds mirrored from the backend's PATCH schema. */
const MAX_TARGET_CENTS = 10_000_000
const MAX_FLOOR_CENTS = 1_000_000
/** Server-side floor for a move-to-card. */
const MIN_MOVE_CENTS = 100

/** `crypto.randomUUID` needs a secure context and is missing on older WebViews and jsdom. */
const randomKey = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

const formatDollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

interface AmountModalProps {
    isOpen: boolean
    title: string
    label: string
    hint?: string
    initialCents?: number
    minCents: number
    maxCents?: number
    ctaLabel: string
    onSave: (cents: number) => Promise<void>
    onClose: () => void
}

/** One dollar-amount prompt for all four edits — same input the limit modal uses. */
const AmountModal: FC<AmountModalProps> = ({
    isOpen,
    title,
    label,
    hint,
    initialCents,
    minCents,
    maxCents,
    ctaLabel,
    onSave,
    onClose,
}) => {
    const t = useTranslations('card.onCard')
    const [value, setValue] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setValue(initialCents != null ? (initialCents / 100).toFixed(2) : '')
            setError(null)
        }
    }, [isOpen, initialCents])

    const save = async () => {
        const dollars = Number(value)
        if (!Number.isFinite(dollars) || dollars < 0) {
            setError(t('invalidAmount'))
            return
        }
        const cents = Math.round(dollars * 100)
        if (cents < minCents) {
            setError(t('minAmount', { amount: formatDollars(minCents) }))
            return
        }
        if (maxCents != null && cents > maxCents) {
            setError(t('maxAmount', { amount: formatDollars(maxCents) }))
            return
        }
        setSaving(true)
        setError(null)
        try {
            await onSave(cents)
            onClose()
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : t('saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            preventClose={saving}
            hideModalCloseButton={saving}
            icon="credit-card"
            title={title}
            content={
                <div className="flex w-full flex-col gap-2 text-left">
                    <label htmlFor="on-card-amount-input" className="text-label-l">
                        {label}
                    </label>
                    <FieldColumn error={error}>
                        <BaseInput
                            id="on-card-amount-input"
                            type="number"
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            min={0}
                            step="0.01"
                            placeholder="0.00"
                            disabled={saving}
                            state={error ? 'error' : 'default'}
                            rightContent={
                                maxCents != null ? (
                                    <LinkButton onClick={() => setValue((maxCents / 100).toFixed(2))} disabled={saving}>
                                        {t('max')}
                                    </LinkButton>
                                ) : undefined
                            }
                        />
                    </FieldColumn>
                    {hint && <p className="text-body-s text-foreground-secondary">{hint}</p>}
                </div>
            }
            ctas={[
                {
                    text: ctaLabel,
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: save,
                    loading: saving,
                    disabled: saving,
                },
            ]}
        />
    )
}

/**
 * "On card" — the two halves of the balance and the rules that move money
 * between them (TASK-22293). On card is what the card spends from; off card
 * is instant for every in-app transfer and never subject to the card's
 * withdrawal lock. The purchase limit is a separate screen and a separate
 * Rain control.
 */
const OnCardScreen: FC<Props> = ({ cardId, onPrev }) => {
    const t = useTranslations('card.onCard')
    const queryClient = useQueryClient()
    const toast = useToast()
    // `onCardCents` is LANDED spending power: what the card can spend and what
    // can be moved off it. In-transit top-ups are shown as pending, never
    // offered as movable.
    const { card, policy, onCardCents, pendingToCardCents, offCardCents, isLoading } = useBalanceSplit()
    const { moveOffCard } = useMoveOffCard()
    const [modal, setModal] = useState<Modal | null>(null)
    const [togglingLoadAll, setTogglingLoadAll] = useState(false)

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.CARD_ON_CARD_VIEWED, {
            on_card_cents: onCardCents,
            off_card_cents: offCardCents,
        })
        // one view event per mount — the balances refresh on their own
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const refresh = useCallback(
        () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
                queryClient.invalidateQueries({ queryKey: ['balance'] }),
            ]),
        [queryClient]
    )

    const patch = useCallback(
        async (input: Parameters<typeof rainApi.updateCollateralSettings>[1], event: string) => {
            try {
                await rainApi.updateCollateralSettings(cardId, input)
            } catch (e) {
                posthog.capture(ANALYTICS_EVENTS.CARD_COLLATERAL_SETTING_FAILED, {
                    setting: event,
                    error_message: e instanceof Error ? e.message : String(e),
                })
                throw e
            }
        },
        [cardId]
    )

    const saveTarget = async (cents: number) => {
        const previous = policy?.targetCents ?? null
        await patch({ collateralTargetCents: cents }, 'target')
        posthog.capture(ANALYTICS_EVENTS.CARD_COLLATERAL_TARGET_CHANGED, { old_cents: previous, new_cents: cents })
        // Lowering the target never withdraws on its own — offer the excess
        // back as one passkey prompt, non-fatal (the target change already
        // landed, and re-saving retries the return).
        if (onCardCents !== null && onCardCents - cents >= EXCESS_COLLATERAL_MIN_CENTS) {
            try {
                const moved = await moveOffCard(onCardCents - cents)
                if (moved > 0) {
                    posthog.capture(ANALYTICS_EVENTS.CARD_MOVE_OFF_CARD, { amount_cents: moved, reason: 'target' })
                    toast.success(t('moveOffCardDone', { amount: formatDollars(moved) }))
                }
            } catch (e) {
                posthog.capture(ANALYTICS_EVENTS.CARD_COLLATERAL_SETTING_FAILED, {
                    setting: 'target_excess_return',
                    error_message: e instanceof Error ? e.message : String(e),
                })
            }
        }
        await refresh()
    }

    const saveFloor = async (cents: number) => {
        const previous = policy?.walletFloorCents ?? null
        await patch({ walletFloorCents: cents }, 'floor')
        posthog.capture(ANALYTICS_EVENTS.CARD_WALLET_FLOOR_CHANGED, { old_cents: previous, new_cents: cents })
        await refresh()
    }

    const toggleLoadAll = async (next: boolean) => {
        setTogglingLoadAll(true)
        try {
            await patch({ loadAllToCard: next }, 'load_all')
            posthog.capture(ANALYTICS_EVENTS.CARD_LOAD_ALL_TOGGLED, { enabled: next })
            await refresh()
        } catch {
            toast.error(t('saveFailed'))
        } finally {
            setTogglingLoadAll(false)
        }
    }

    // One key per (tap, amount), kept until the attempt succeeds: an exact
    // retry after a lost response replays the first move server-side instead
    // of moving twice, while an edited amount is a new request with its own
    // key — the old key must never carry a different amount.
    const moveKeyRef = useRef<{ key: string; cents: number } | null>(null)
    const moveToCard = async (cents: number) => {
        const reuse = moveKeyRef.current?.cents === cents ? moveKeyRef.current.key : null
        const idempotencyKey = reuse ?? `${cardId.slice(0, 8)}-${cents}-${randomKey()}`
        moveKeyRef.current = { key: idempotencyKey, cents }
        try {
            const res = await rainApi.moveToCard(cardId, { amountCents: cents, idempotencyKey })
            moveKeyRef.current = null
            posthog.capture(ANALYTICS_EVENTS.CARD_MOVE_TO_CARD, { amount_cents: res.amountCents })
            toast.success(t('moveToCardDone', { amount: formatDollars(res.amountCents) }))
        } catch (e) {
            posthog.capture(ANALYTICS_EVENTS.CARD_COLLATERAL_SETTING_FAILED, {
                setting: 'move_to_card',
                error_message: e instanceof Error ? e.message : String(e),
            })
            throw new Error(t('moveFailed'))
        }
        await refresh()
    }

    const moveOff = async (cents: number) => {
        // The target has to sit below what stays on the card — and
        // load-everything, which ignores the target, has to be off — before
        // the withdrawal lands, or the balancer sweeps the returned money
        // straight back. That PATCH runs between the passkey and the
        // broadcast: a cancelled passkey leaves the policy untouched, a
        // failed PATCH leaves the signed withdrawal unsent. `pinTarget:
        // false` keeps an auto-sized card auto-sized — this is a lowering
        // the move forces, not a number the user chose. The inflow debounce
        // also holds the returned money off the card for a few minutes.
        const remaining = Math.max(0, (onCardCents ?? 0) - cents)
        const lowerTarget =
            policy && (policy.loadAllToCard || remaining < policy.targetCents)
                ? async () => {
                      const nextTarget = Math.min(remaining, policy.targetCents)
                      await patch(
                          {
                              collateralTargetCents: nextTarget,
                              pinTarget: false,
                              ...(policy.loadAllToCard ? { loadAllToCard: false } : {}),
                          },
                          'target'
                      )
                      posthog.capture(ANALYTICS_EVENTS.CARD_COLLATERAL_TARGET_CHANGED, {
                          old_cents: policy.targetCents,
                          new_cents: nextTarget,
                          reason: 'move_off_card',
                          load_all_disabled: policy.loadAllToCard,
                      })
                  }
                : undefined
        const moved = await moveOffCard(cents, { beforeSubmit: lowerTarget })
        if (moved <= 0) throw new Error(t('moveFailed'))
        posthog.capture(ANALYTICS_EVENTS.CARD_MOVE_OFF_CARD, { amount_cents: moved, reason: 'manual' })
        toast.success(t('moveOffCardDone', { amount: formatDollars(moved) }))
        await refresh()
    }

    const closeModal = () => setModal(null)
    const loadAll = policy?.loadAllToCard ?? false
    const canMoveToCard = !!card?.hasWithdrawApproval && (offCardCents ?? 0) >= MIN_MOVE_CENTS
    const canMoveOffCard = (onCardCents ?? 0) >= EXCESS_COLLATERAL_MIN_CENTS

    return (
        <PageStack gap="6">
            <NavHeader title={t('navTitle')} onPrev={onPrev} />

            {isLoading || !policy ? (
                <div className="flex justify-center py-8">
                    <Loading />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <BalanceTile
                            label={t('onCard')}
                            cents={onCardCents}
                            note={
                                pendingToCardCents > 0
                                    ? t('pending', { amount: formatDollars(pendingToCardCents) })
                                    : undefined
                            }
                        />
                        <BalanceTile label={t('offCard')} cents={offCardCents} />
                    </div>
                    <p className="text-body-s text-foreground-secondary">{t('summary')}</p>

                    {!policy.autoBalanceEnabled && (
                        <Notification priority="attention">{t('autoBalanceOff')}</Notification>
                    )}

                    <div className="space-y-4">
                        <Section title={t('autoTitle')}>
                            <ListGroup>
                                <ListItem
                                    title={t('keepOnCard')}
                                    body={loadAll ? t('loadAllActive') : policy.targetPinned ? t('pinned') : t('tuned')}
                                    trailing={
                                        <span className="text-body-m-semibold tabular-nums">
                                            {formatDollars(policy.targetCents)}
                                        </span>
                                    }
                                    chevron
                                    disabled={loadAll}
                                    onClick={() => setModal('target')}
                                />
                                <ListItem
                                    title={t('keepOffCard')}
                                    body={t('keepOffCardHint')}
                                    trailing={
                                        <span className="text-body-m-semibold tabular-nums">
                                            {formatDollars(policy.walletFloorCents)}
                                        </span>
                                    }
                                    chevron
                                    disabled={loadAll}
                                    onClick={() => setModal('floor')}
                                />
                                <ListItem
                                    title={t('loadAll')}
                                    body={t('loadAllHint')}
                                    trailing={
                                        <Toggle
                                            checked={loadAll}
                                            disabled={togglingLoadAll}
                                            onChange={(next) => void toggleLoadAll(next)}
                                            aria-label={t('loadAll')}
                                        />
                                    }
                                />
                            </ListGroup>
                        </Section>

                        <Section title={t('moveTitle')}>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    disabled={!canMoveToCard}
                                    onClick={() => setModal('toCard')}
                                >
                                    {t('moveToCard')}
                                </Button>
                                <Button variant="stroke" disabled={!canMoveOffCard} onClick={() => setModal('offCard')}>
                                    {t('moveOffCard')}
                                </Button>
                            </div>
                            {!card?.hasWithdrawApproval && (
                                <p className="mt-2 text-body-s text-foreground-secondary">{t('setupRequired')}</p>
                            )}
                        </Section>

                        <Notification priority="info">{t('lockNote')}</Notification>
                    </div>

                    <AmountModal
                        isOpen={modal === 'target'}
                        title={t('editTargetTitle')}
                        label={t('keepOnCard')}
                        hint={t('keepOnCardHint')}
                        initialCents={policy.targetCents}
                        minCents={0}
                        maxCents={MAX_TARGET_CENTS}
                        ctaLabel={t('save')}
                        onSave={saveTarget}
                        onClose={closeModal}
                    />
                    <AmountModal
                        isOpen={modal === 'floor'}
                        title={t('editFloorTitle')}
                        label={t('keepOffCard')}
                        hint={t('keepOffCardHint')}
                        initialCents={policy.walletFloorCents}
                        minCents={0}
                        maxCents={MAX_FLOOR_CENTS}
                        ctaLabel={t('save')}
                        onSave={saveFloor}
                        onClose={closeModal}
                    />
                    <AmountModal
                        isOpen={modal === 'toCard'}
                        title={t('moveToCardTitle')}
                        label={t('amountLabel')}
                        hint={t('moveToCardHint')}
                        minCents={MIN_MOVE_CENTS}
                        maxCents={offCardCents ?? undefined}
                        ctaLabel={t('moveToCard')}
                        onSave={moveToCard}
                        onClose={closeModal}
                    />
                    <AmountModal
                        isOpen={modal === 'offCard'}
                        title={t('moveOffCardTitle')}
                        label={t('amountLabel')}
                        hint={t('moveOffCardHint')}
                        minCents={EXCESS_COLLATERAL_MIN_CENTS}
                        maxCents={onCardCents ?? undefined}
                        ctaLabel={t('moveOffCard')}
                        onSave={moveOff}
                        onClose={closeModal}
                    />
                </>
            )}
        </PageStack>
    )
}

const BalanceTile: FC<{ label: string; cents: number | null; note?: string }> = ({ label, cents, note }) => (
    <Card className="px-4 py-3">
        <div className="text-body-s text-foreground-secondary">{label}</div>
        <div className="text-heading-s text-foreground-primary tabular-nums">
            {cents === null ? '—' : formatDollars(cents)}
        </div>
        {note && <div className="text-body-s text-foreground-secondary">{note}</div>}
    </Card>
)

export default OnCardScreen
