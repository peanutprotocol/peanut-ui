'use client'

/**
 * The pay screen of the crypto withdrawal for a destination that came from a
 * scanned QR code (TASK-23974): the address on a card, the amount with the
 * balance, the token and network pickers and "Send with Peanut", all on one
 * screen, the way the payment page lays them out. A typed destination goes
 * through the destination form (InitialWithdrawView) and the amount step
 * instead; this screen replaces both.
 */

import { useContext } from 'react'
import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Callout } from '@/components/0_Bruddle/Callout'
import CooldownErrorText from '@/components/Global/RainCooldown/CooldownErrorText'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import UserCard from '@/components/User/UserCard'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { areEvmAddressesEqual } from '@/utils/general.utils'
import type { RecipientState } from '@/components/Global/GeneralRecipientInput/types'
import type { WithdrawAddressFamily } from '@/lib/validation/addressFamily'
import type { FlowErrorState } from '@/interfaces/interfaces'
import { withdrawChainRecord } from '../chain-record'
import type { WithdrawData } from '../types'

interface ScannedDestinationPayViewProps {
    recipient: RecipientState
    /** The scanned address's family: the pickers offer only its networks. */
    addressFamily: WithdrawAddressFamily
    initialAmount: string
    walletBalance: string
    /** Full-precision spendable balance — tapping the balance row fills the field with it (floored to cents). */
    balanceFillAmount: number
    onBalanceFilled: (value: string) => void
    onAmountChange: (value: string | undefined) => void
    onBack: () => void
    onContinue: (data: Omit<WithdrawData, 'amount'>) => void
    continueDisabled: boolean
    isLoading?: boolean
    /** Why the amount cannot go, under the field. */
    amountError?: string
    /** Why the review could not be prepared, under the button. */
    error: FlowErrorState
}

/** Pay screen for a scanned destination — dumb view, state lives in the flow hook + URL. */
export default function ScannedDestinationPayView({
    recipient,
    addressFamily,
    initialAmount,
    walletBalance,
    balanceFillAmount,
    onBalanceFilled,
    onAmountChange,
    onBack,
    onContinue,
    continueDisabled,
    isLoading = false,
    amountError,
    error,
}: ScannedDestinationPayViewProps) {
    const t = useTranslations('payment')
    const { selectedTokenData, selectedChainID, selectedTokenAddress, supportedChainsAndTokens } =
        useContext(tokenSelectorContext)

    const chain = withdrawChainRecord(supportedChainsAndTokens, selectedChainID)
    const canContinue = !!selectedTokenData && !!chain && !!recipient.address
    const handleContinue = () => {
        if (!selectedTokenData || !chain || !recipient.address || continueDisabled || isLoading) return
        onContinue({ token: selectedTokenData, chain, address: recipient.address })
    }

    // the free route is USDC on the wallet chain; the hint only makes sense for
    // an address that could use it, so never for a Solana or Tron one
    const isUsingPeanutDefault =
        selectedChainID === PEANUT_WALLET_CHAIN.id.toString() &&
        areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)
    const showFreeRouteHint = addressFamily === 'evm' && !isUsingPeanutDefault

    return (
        <PageStack>
            <NavHeader title={t('headers.pay')} onPrev={onBack} />

            <PageStack.Center className="gap-4">
                <UserCard
                    type="send"
                    // the full address: the card's AddressLink shortens it and links to it
                    username={recipient.name ?? recipient.address}
                    recipientType={recipient.name ? 'ENS' : 'ADDRESS'}
                    isVerified={false}
                />

                {/* amount input + its field error form one column, 4px apart */}
                <div className="flex flex-col gap-1">
                    <AmountInput
                        initialAmount={initialAmount}
                        setPrimaryAmount={onAmountChange}
                        primaryDenomination={{
                            symbol: '$',
                            price: 1,
                            decimals: 6, // USDC decimals, to pay exactly
                        }}
                        onSubmit={handleContinue}
                        walletBalance={walletBalance}
                        balanceFillAmount={balanceFillAmount}
                        onBalanceFilled={onBalanceFilled}
                        hideCurrencyToggle
                    />
                    {amountError && <FieldError>{amountError}</FieldError>}
                </div>

                <TokenSelector viewType="withdraw" addressFamily={addressFamily} />

                {showFreeRouteHint && (
                    <div className="pt-1 text-center text-body-xs text-foreground-secondary">
                        <span>{t('input.freeTransactionsHint')}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <SendWithPeanutCta
                        onClick={handleContinue}
                        disabled={!canContinue || continueDisabled || isLoading}
                        loading={isLoading}
                    />
                    {error.showError && !!error.errorMessage && (
                        <Callout priority="error">
                            <CooldownErrorText message={error.errorMessage} />
                        </Callout>
                    )}
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
