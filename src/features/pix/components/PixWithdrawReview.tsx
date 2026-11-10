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
import type { PixWithdrawDisplay } from '@/services/pix'
import type { ProviderId } from '@/types/provider.types'
import { formatBankAmount } from '@/utils/currency'
import { formatCurrency } from '@/utils/general.utils'
import { arrivalMinutes, pixShownRate } from '@/features/pix/pixFlow.utils'

/**
 * Review of a Pix withdrawal, from POST /pix/withdraw/preview: the reais
 * the account receives as the headline, the key in its own group, then what
 * leaves the wallet, the rate with every percentage fee inside, the
 * provider's flat fee as its own line where it charges one, and the API's
 * arrival estimate.
 * Dumb view: the flow owns the preview and the confirm.
 */
export function PixWithdrawReview({
    title,
    display,
    providerId,
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
    display: PixWithdrawDisplay | null
    /** The provider the route names, for its row and sheet; null shows no row. */
    providerId: ProviderId | null
    isLoading: boolean
    isSubmitting: boolean
    /** A refusal (error), or the opened quote that moved since the review (attention). */
    error: { message: string; action?: { label: string; onClick: () => void }; priority?: 'error' | 'attention' } | null
    canConfirm: boolean
    onBack: () => void
    onConfirm: () => void
    onCancel: () => void
}) {
    const t = useTranslations('pix.withdraw')
    const tWithdraw = useTranslations('withdraw')
    const tCommon = useTranslations('common')
    const destination = display ? [display.bankName, display.holderName].filter(Boolean).join(' · ') : ''
    const errorCallout = error && (
        <Callout priority={error.priority ?? 'error'} ctas={error.action ? [error.action] : undefined}>
            {error.message}
        </Callout>
    )

    // a refused preview has no numbers: the message and its action stand alone, no empty rows
    if (!display && !isLoading) {
        return (
            <PageStack>
                <NavHeader title={title} onPrev={onBack} />
                <PageStack.Center>
                    {errorCallout}
                    <div className="flex flex-col items-center">
                        <LinkButton onClick={onCancel}>{tCommon('cancel')}</LinkButton>
                    </div>
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <div className="text-center">
                    <p className="text-body-s text-foreground-secondary">{t('withdrawing')}</p>
                    {display ? (
                        <p className="text-heading-s text-foreground-primary">
                            {formatBankAmount(display.amountBrl, 'BRL')}
                        </p>
                    ) : (
                        // same line height as the amount, so the swap does not move the card
                        <div className="mx-auto my-1 h-6 w-28 animate-pulse rounded bg-background-skeleton" />
                    )}
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
                            value={display ? `1 USD = BRL ${formatCurrency(pixShownRate(display), 6)}` : ''}
                            loading={isLoading}
                        />
                        {/* the rate holds the percentage fees; a flat fee is its own line (Hugo's fees table),
                            and a provider that charges none shows no line */}
                        {!(display && Number(display.fixedFeeBrl) === 0) && (
                            <DataRow
                                label={t('fee')}
                                value={display ? formatBankAmount(display.fixedFeeBrl, 'BRL') : ''}
                                loading={isLoading}
                            />
                        )}
                        <DataRow
                            label={tWithdraw('bank.arrives')}
                            value={
                                display
                                    ? t('arrivesIn', { minutes: arrivalMinutes(display.arrivalEstimateSeconds) })
                                    : ''
                            }
                            loading={isLoading}
                        />
                        {providerId && <ProviderRow providerId={providerId} />}
                    </DataRowGroup>
                </Card>

                {errorCallout}

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
