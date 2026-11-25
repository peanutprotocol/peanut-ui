'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Loading from '@/components/Global/Loading'
import { CARD_FUNDING_RETURN_TO } from '@/features/card/cardAddMoney'
import { DepositDetailsCard } from '@/features/deposit-accounts/components/DepositDetailsCard'
import { instructionRows } from '@/features/deposit-accounts/instructionRows'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useBridgeProviderId } from '@/hooks/useBridgeProviderId'
import { formatBankAmount } from '@/utils/currency'
import { withReturnTo } from '@/utils/return-to.utils'

/**
 * The held account's bank details, to send the gap from the user's own bank. No rate is known here,
 * so a non-dollar account names the dollar value only. Resuming after the transfer is out of scope
 * (TASK-25169): "I've sent the transfer" closes the drawer and the funding step stays.
 */
export function CardBankDetailsView({
    corridor,
    gapUsd,
    onSent,
}: {
    corridor: DepositCorridor
    gapUsd: number | undefined
    onSent: () => void
}) {
    const t = useTranslations('card.addMoney')
    const tMethods = useTranslations('addMoney.methods')
    const tBank = useTranslations('addMoney.bankDetails')
    const router = useRouter()
    const { accounts, isLoading } = useDepositAccounts()
    const { t: tAccounts, rowLabels, railLabels, arrivalDetail } = useDepositAccountCopy()
    const bridgeProviderId = useBridgeProviderId()
    const rail = DEPOSIT_RAILS[corridor]
    const instructions = accounts[corridor]?.instructions
    // "Accepts" holds nothing to paste into a transfer, as on the details screen
    const rows = instructions
        ? instructionRows(instructions, rowLabels, railLabels).filter((row) => row.key !== 'accepts')
        : []
    const gap = gapUsd ? formatBankAmount(gapUsd, 'USD') : undefined

    return (
        <div className="flex flex-col gap-4" data-testid="card-add-money-bank-details">
            {gap && (
                <p className="text-body-m text-foreground-primary">
                    {rail.currency === 'USD'
                        ? t('amountToSend', { amount: gap })
                        : t('amountToSendConverted', { amount: gap, currency: rail.currency })}
                </p>
            )}
            {isLoading ? (
                <Loading />
            ) : (
                rows.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <DepositDetailsCard
                            rows={rows}
                            providerId={rail.provider === 'bridge' ? bridgeProviderId : null}
                        />
                        {/* a transfer without the reference is not matched to the account */}
                        {instructions?.depositMessage && (
                            <p className="text-body-xs text-foreground-secondary">
                                {tAccounts('details.referenceRequired')}
                            </p>
                        )}
                        <p className="text-body-xs text-foreground-secondary">{arrivalDetail(corridor)}</p>
                    </div>
                )
            )}
            <Button variant="primary" className="w-full" onClick={onSent}>
                {tBank('sentTransfer')}
            </Button>
            <div className="mt-2 flex justify-center">
                <LinkButton onClick={() => router.push(withReturnTo('/add-money?method=bank', CARD_FUNDING_RETURN_TO))}>
                    {tMethods('moreWays')}
                </LinkButton>
            </div>
        </div>
    )
}
