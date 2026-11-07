'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { DataRowGroup } from '@/components/0_Bruddle/DataRowGroup'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { ProviderRow } from '@/components/Provider/ProviderRow'
import type { AveniaWithdrawDisplay } from '@/services/avenia'
import { formatBankAmount } from '@/utils/currency'
import { formatCurrency } from '@/utils/general.utils'
import { arrivalMinutes, aveniaShownRate } from '@/features/avenia/avenia.utils'

/**
 * Review of a Pix withdrawal, from POST /avenia/withdraw/preview: the reais
 * the account receives as the headline, the key in its own group, then what
 * leaves the wallet, the rate with every percentage fee inside (Avenia's and
 * Rhino's), Avenia's flat fee as its own line, and the API's arrival estimate.
 * Dumb view: the flow owns the preview and the confirm.
 */
export function AveniaWithdrawReview({
    title,
    display,
    isLoading,
    isSubmitting,
    error,
    canConfirm,
    onBack,
    onConfirm,
    onCancel,
}: {
    title: string
    /** null while the preview loads, and after it was refused */
    display: AveniaWithdrawDisplay | null
    isLoading: boolean
    isSubmitting: boolean
    /** A refusal (error), or the opened quote that moved since the review (attention). */
    error: { message: string; onRetry?: () => void; priority?: 'error' | 'attention' } | null
    canConfirm: boolean
    onBack: () => void
    onConfirm: () => void
    onCancel: () => void
}) {
    const t = useTranslations('avenia.withdraw')
    const tWithdraw = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const destination = display ? [display.bankName, display.holderName].filter(Boolean).join(' · ') : ''

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <div className="text-center">
                    <p className="text-body-s text-foreground-secondary">{tWithdraw('manteca.youreWithdrawing')}</p>
                    {display ? (
                        <p className="text-heading-s text-foreground-primary">
                            {formatBankAmount(display.amountBrl, 'BRL')}
                        </p>
                    ) : isLoading ? (
                        // same line height as the amount, so the swap does not move the card
                        <div className="mx-auto my-1 h-6 w-28 animate-pulse rounded bg-background-skeleton" />
                    ) : null}
                    {destination && (
                        <p className="text-body-s text-foreground-secondary">{t('toAccount', { destination })}</p>
                    )}
                </div>

                <Card position="solo" className="divide-y divide-dashed divide-border-default px-4 py-0">
                    <DataRowGroup>
                        <DataRow
                            label={tWithdraw('pixKey.placeholder')}
                            value={display?.pixKey ?? ''}
                            loading={isLoading}
                        />
                    </DataRowGroup>
                    <DataRowGroup>
                        <DataRow
                            label={tWithdraw('confirm.youPay')}
                            value={display ? formatBankAmount(display.withdrawUsd, 'USD') : ''}
                            loading={isLoading}
                        />
                        <DataRow
                            label={tCommon('exchangeRate')}
                            value={display ? `1 USD = BRL ${formatCurrency(aveniaShownRate(display), 6)}` : ''}
                            loading={isLoading}
                        />
                        {/* the rate holds the percentage fees; the flat fee is its own line (Hugo's fees table) */}
                        <DataRow
                            label={t('aveniaFee')}
                            value={display ? formatBankAmount(display.fixedFeeBrl, 'BRL') : ''}
                            loading={isLoading}
                        />
                        <DataRow
                            label={tWithdraw('bank.arrives')}
                            value={
                                display
                                    ? t('arrivesIn', { minutes: arrivalMinutes(display.arrivalEstimateSeconds) })
                                    : ''
                            }
                            loading={isLoading}
                        />
                        <ProviderRow providerId="avenia-br" />
                    </DataRowGroup>
                </Card>

                {error && (
                    <Callout
                        priority={error.priority ?? 'error'}
                        ctas={error.onRetry ? [{ label: tCommon('retry'), onClick: error.onRetry }] : undefined}
                    >
                        {error.message}
                    </Callout>
                )}

                <div className="flex flex-col items-center gap-6">
                    <Button
                        variant="primary"
                        className="w-full"
                        loading={isSubmitting}
                        disabled={!canConfirm || isSubmitting}
                        onClick={onConfirm}
                    >
                        {tCommon('confirm')}
                    </Button>
                    <LinkButton onClick={onCancel} disabled={isSubmitting}>
                        {tCommon('cancel')}
                    </LinkButton>
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
