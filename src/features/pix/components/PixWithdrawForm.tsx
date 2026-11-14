'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PIX } from '@/assets/payment-apps'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import RateUnavailable from '@/components/Global/RateUnavailable'
import { SYMBOLS_BY_CURRENCY_CODE } from '@/constants/currency-symbols.consts'
import { AmountCard } from '@/features/payments/shared/components/AmountCard'
import { PaymentDetailsCard } from '@/features/payments/shared/components/PaymentDetailsCard'
import { RecipientCard } from '@/features/payments/shared/components/RecipientCard'
import { SaveRecipientCard, type SaveRecipientState } from '@/features/payments/shared/components/SaveRecipientCard'
import { pixShownRate } from '@/features/pix/pixFlow.utils'
import type { PixWithdrawDisplay } from '@/services/pix'
import type { ProviderId } from '@/types/provider.types'
import { formatBankAmount } from '@/utils/currency'
import { pixKeyOwnerDetails } from '@/utils/pix.utils'

/** How the form's amount field starts: the amount already typed, in the denomination it was typed in. */
export interface PixWithdrawAmountSeed {
    amount: string
    denomination: 'BRL' | 'USD'
}

/**
 * The one form of a Pix withdrawal, after the key resolved: the Pix-key
 * payment form with "Withdrawing" as its lead word and Confirm as its button
 * (ruling 2026-11-12, providers are cattle). Where the provider says the key is
 * another person's (`ownAccount` false), the same form is a send to them, and
 * leads with "Sending" (TASK-24910). The recipient card, the save
 * card, the amount card and the details card are the payment form's own
 * parts; the details card adds the provider's flat fee where the quote
 * carries one, and the exact reais and wallet debit the quote names. Dumb
 * view: the flow owns the quote, the preview, the draft and the confirm.
 *
 * The save card stores the key through POST /manteca/pix-key/saved; an own key
 * lands under Withdraw once api#2129 is deployed (before it, the save stores a
 * recipient, as today). The flow offers it on Manteca's route only
 * (`pixKeySaveOffered`); `save.isOffered` false leaves the card out.
 */
export function PixWithdrawForm({
    title,
    onBack,
    recipient,
    save,
    amount,
    display,
    payout,
    total,
    providerId,
    error,
    isSubmitting,
    canConfirm,
    onConfirm,
}: {
    title: string
    onBack: () => void
    /** The resolved key: its holder and bank from the lookup, or from the quote after a reload; whose key it is, where the provider tells. */
    recipient: {
        pixKey: string
        holderName: string | null
        bankName: string | null
        taxIdMasked: string | null
        ownAccount?: boolean | null
    }
    save: SaveRecipientState
    amount: {
        /** Read once, when the form mounts: the field is never re-seeded while the user types. */
        seed: PixWithdrawAmountSeed | null
        /** BRL per USD the field converts with: the quote in hand's ratio for the amount as entered (payout per USD entered, or per USD debited for typed reais), else the indicative quote's; null while it loads. */
        price: number | null
        isLoading: boolean
        isError: boolean
        onRetry: () => void
        /** An opened withdrawal keeps its amount. */
        disabled: boolean
        /** Under the field: the balance, or the provider's minimum. */
        error?: string
        walletBalance?: string
        balanceFillAmount?: number
        onBrlChange: (value: string) => void
        onUsdChange: (value: string) => void
        onBalanceFilled: () => void
        onAmountTyped: (symbol: string) => void
    }
    /** The quote for the amount on screen (POST /pix/withdraw/preview), or the opened withdrawal's; null while it loads, while the amount still changes, or after it was refused. */
    display: PixWithdrawDisplay | null
    /** The exact reais the quote pays out, where the amount was not typed in reais; null waits, left out shows no row. */
    payout?: string | null
    /** The exact wallet debit the quote names; null waits, left out shows no row. */
    total?: string | null
    /** The provider the route names, for its row and sheet; null shows no row. */
    providerId: ProviderId | null
    /** A refusal (error), or the opened quote that moved since the form (attention). */
    error: { message: string; action?: { label: string; onClick: () => void }; priority?: 'error' | 'attention' } | null
    isSubmitting: boolean
    canConfirm: boolean
    onConfirm: () => void
}) {
    const t = useTranslations('pix.withdraw')
    const tCommon = useTranslations('common')
    const tPayment = useTranslations('payment')
    // the seed the flow hands over at mount; later renders carry the live typed values, which the field already shows
    const [seed] = useState(amount.seed)
    // as the payment form: the holder's name leads, the key and tax ID under it; an unnamed holder leaves the key as the heading
    const details = recipient.holderName ? pixKeyOwnerDetails(recipient.pixKey, recipient.taxIdMasked) : null
    // the preview's all-in rate agrees with the fee row and the USD to the centavo; before it, the quote the field converts with
    const rate = display
        ? { price: Number(pixShownRate(display)), code: 'BRL' }
        : amount.price !== null
          ? { price: amount.price, code: 'BRL' }
          : null
    // the rate holds the percentage fees; a flat fee is its own line, and a provider that charges none shows no line
    const providerFee = display && Number(display.fixedFeeBrl) > 0 ? formatBankAmount(display.fixedFeeBrl, 'BRL') : null

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center className="gap-4">
                <RecipientCard
                    lead={recipient.ownAccount === false ? tPayment('confirm.sending') : t('withdrawing')}
                    icon={PIX}
                    name={recipient.holderName ?? recipient.pixKey}
                    maskName
                    pixKey={details?.pixKey}
                    taxId={details?.taxId}
                    bankName={recipient.bankName}
                />

                {/* A refusal, or the opened quote that moved: directly under the recipient, so it sits in the first
                    viewport whatever cards the form carries (Chip, ui#4082: under the button it fell below the fold). */}
                {error && (
                    <Callout priority={error.priority ?? 'error'} ctas={error.action ? [error.action] : undefined}>
                        {error.message}
                    </Callout>
                )}

                <SaveRecipientCard save={save} />

                {/* the quote failed (the route changed, the provider is down): retry here, not a spinner */}
                {amount.isError ? (
                    <RateUnavailable onRetry={amount.onRetry} />
                ) : amount.isLoading || amount.price === null ? (
                    <Loading />
                ) : (
                    <AmountCard
                        initialAmount={seed?.amount}
                        initialDenomination={seed?.denomination === 'USD' ? 'USD' : undefined}
                        setPrimaryAmount={amount.onBrlChange}
                        setSecondaryAmount={amount.onUsdChange}
                        // R$, as the deposit amount shows reais
                        primaryDenomination={{ symbol: SYMBOLS_BY_CURRENCY_CODE.BRL, price: amount.price, decimals: 2 }}
                        secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                        onBalanceFilled={amount.onBalanceFilled}
                        onAmountTyped={amount.onAmountTyped}
                        walletBalance={amount.walletBalance}
                        balanceFillAmount={amount.balanceFillAmount}
                        disabled={amount.disabled}
                        error={amount.error}
                    />
                )}

                <PaymentDetailsCard
                    rate={rate}
                    providerFee={providerFee}
                    payout={payout}
                    total={total}
                    providerId={providerId}
                />

                <Button
                    variant="primary"
                    className="w-full"
                    loading={isSubmitting}
                    disabled={!canConfirm || isSubmitting}
                    onClick={onConfirm}
                >
                    {tCommon('confirm')}
                </Button>
            </PageStack.Center>
        </PageStack>
    )
}
