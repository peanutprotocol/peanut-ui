'use client'

/**
 * input view for semantic request flow
 *
 * displays:
 * - recipient card (address/ens/username)
 * - amount input
 * - token selector (for address/ens recipients, not usernames)
 * - payment method options
 *
 * for same-chain usdc: executes payment directly
 * for cross-chain: navigates to confirm view
 */

import { useEffect, useContext } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import ErrorAlert from '@/components/Global/ErrorAlert'
import SupportCTA from '@/components/Global/SupportCTA'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { useRouter } from 'next/navigation'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'
import { printableAddress, areEvmAddressesEqual } from '@/utils/general.utils'
import { tokenSelectorContext } from '@/context'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'

export function SemanticRequestInputView() {
    const router = useRouter()
    const {
        amount,
        recipient,
        parsedUrl,
        isAmountFromUrl,
        error,
        formattedBalance,
        canProceed,
        isInsufficientBalance,
        isLoading,
        isLoggedIn,
        isConnected,
        setAmount,
        handlePayment,
    } = useSemanticRequestFlow()

    // token selector context for setting initial values from url
    const {
        setSelectedChainID,
        setSelectedTokenAddress,
        selectedChainID,
        selectedTokenAddress,
        supportedSquidChainsAndTokens,
    } = useContext(tokenSelectorContext)

    // initialize token/chain from parsed url
    useEffect(() => {
        if (!parsedUrl) return

        // set chain from url if available
        if (parsedUrl.chain?.chainId) {
            setSelectedChainID(parsedUrl.chain.chainId)
        } else {
            // default to arbitrum for external recipients
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
        }

        // set token from url if available
        if (parsedUrl.token?.address) {
            setSelectedTokenAddress(parsedUrl.token.address)
        } else if (parsedUrl.chain?.chainId) {
            // default to usdc on the selected chain
            const chainData = supportedSquidChainsAndTokens[parsedUrl.chain.chainId]
            const defaultToken = chainData?.tokens.find((t) => t.symbol.toLowerCase() === 'usdc')
            if (defaultToken) {
                setSelectedTokenAddress(defaultToken.address)
            }
        } else {
            // default to peanut wallet usdc
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [parsedUrl, setSelectedChainID, setSelectedTokenAddress, supportedSquidChainsAndTokens])

    // handle submit
    const handleSubmit = () => {
        if (canProceed && !isLoading) {
            handlePayment()
        }
    }

    // handle back navigation
    const handleGoBack = () => {
        if (window.history.length > 1) {
            router.back()
        } else {
            router.push('/')
        }
    }

    // determine button state
    const isButtonDisabled = !canProceed || isLoading
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    // get display name for recipient
    const recipientDisplayName =
        recipient?.recipientType === 'ADDRESS'
            ? printableAddress(recipient.resolvedAddress)
            : recipient?.identifier || ''

    // check if using peanut wallet default (usdc on arb)
    const isUsingPeanutDefault =
        selectedChainID === PEANUT_WALLET_CHAIN.id.toString() &&
        areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)

    // determine if we should show token selector
    // only show when chain is NOT specified in url AND recipient is ADDRESS or ENS
    const showTokenSelector =
        !parsedUrl?.chain?.chainId &&
        (recipient?.recipientType === 'ADDRESS' || recipient?.recipientType === 'ENS') &&
        isConnected

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={handleGoBack} title="Pay" />

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* recipient card */}
                {recipient && (
                    <UserCard
                        type="send"
                        username={
                            recipient.recipientType === 'ADDRESS'
                                ? printableAddress(recipient.resolvedAddress)
                                : recipientDisplayName
                        }
                        recipientType={recipient.recipientType}
                        isVerified={false}
                    />
                )}

                {/* amount input */}
                <TokenAmountInput
                    tokenValue={amount}
                    setTokenValue={(val) => setAmount(val ?? '')}
                    onSubmit={handleSubmit}
                    walletBalance={isLoggedIn ? formattedBalance : undefined}
                    hideBalance={!isLoggedIn}
                    hideCurrencyToggle={true}
                    disabled={isAmountFromUrl}
                />

                {/* token selector for chain/token selection (not for USERNAME) */}
                {showTokenSelector && <TokenSelector viewType="req_pay" />}

                {/* hint for free transactions */}
                {showTokenSelector && selectedTokenAddress && selectedChainID && !isUsingPeanutDefault && (
                    <div className="pt-1 text-center text-xs text-grey-1">
                        <span>Use USDC on Arbitrum for free transactions!</span>
                    </div>
                )}

                {/* button and error */}
                <div className="space-y-4">
                    <SendWithPeanutCta onClick={handleSubmit} disabled={isButtonDisabled} loading={isLoading} />
                    {isInsufficientBalance && (
                        <ErrorAlert description="Not enough balance to fulfill this request with Peanut" />
                    )}
                    {error.showError && <ErrorAlert description={error.errorMessage} />}
                </div>

                {/* action list for non-logged in users */}
                <PaymentMethodActionList isAmountEntered={isAmountEntered} />
            </div>

            {/* support cta */}
            {!isLoggedIn && <SupportCTA />}
        </div>
    )
}
