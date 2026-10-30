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
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Callout } from '@/components/0_Bruddle/Callout'
import CooldownErrorText from '@/components/Global/RainCooldown/CooldownErrorText'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import UserCard from '@/components/User/UserCard'
import SupportCTA from '@/components/Global/SupportCTA'
import { useSemanticRequestFlow } from '../useSemanticRequestFlow'
import { useSafeBack } from '@/hooks/useSafeBack'
import SendWithPeanutCta from '@/features/payments/shared/components/SendWithPeanutCta'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { useTranslations } from 'next-intl'

// the amount field is in USD, to USDC precision
const USD_DENOMINATION = { symbol: '$', price: 1, decimals: 6 }

export function SemanticRequestInputView() {
    const onBack = useSafeBack('/')
    const t = useTranslations('payment')
    const {
        amount,
        recipient,
        parsedUrl,
        charge,
        chargeIdFromUrl,
        isAmountFromUrl,
        error,
        formattedBalance,
        balanceFillAmount,
        canProceed,
        isInsufficientBalance,
        isLoading,
        isLoggedIn,
        setAmount,
        handlePayment,
        setCurrentView,
    } = useSemanticRequestFlow()

    // token selector context for setting initial values from url
    const { setSelectedChainID, setSelectedTokenAddress, supportedChainsAndTokens } = useContext(tokenSelectorContext)

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
            const chainData = supportedChainsAndTokens[parsedUrl.chain.chainId]
            const defaultToken = chainData?.tokens.find((t) => t.symbol.toLowerCase() === 'usdc')
            if (defaultToken) {
                setSelectedTokenAddress(defaultToken.address)
            }
        } else {
            // default to peanut wallet usdc
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [parsedUrl, setSelectedChainID, setSelectedTokenAddress, supportedChainsAndTokens])

    // handle submit
    const handleSubmit = () => {
        if (canProceed && !isLoading) {
            handlePayment()
        }
    }

    const handleOpenExternalWalletFlow = async () => {
        if (canProceed && !isLoading) {
            const res = await handlePayment(true, true) // return after creating charge
            // Proceed only if charge is created successfully
            if (res && res.success) {
                setCurrentView('EXTERNAL_WALLET')
            }
        }
    }

    // An open-amount request names who is asking: the charge carries their
    // handle, while the recipient derived from it is only their address.
    const openAmountRequester = charge?.openAmount ? charge.requestLink?.recipientAccount?.user : undefined

    // determine button state
    const isButtonDisabled = !canProceed || isLoading
    const isAmountEntered = !!amount && parseFloat(amount) > 0

    // The balance row and the field are both USD: a request is paid in USDC or
    // USDT only (TASK-23850), so a fill always matches what the user pays.
    const balanceFill = isLoggedIn ? balanceFillAmount : undefined

    return (
        <PageStack>
            <NavHeader onPrev={onBack} title={t('headers.pay')} />

            <PageStack.Center className="gap-4">
                {/* recipient card */}
                {openAmountRequester?.username ? (
                    <UserCard
                        type="request_pay"
                        username={openAmountRequester.username}
                        recipientType="USERNAME"
                        avatarKey={openAmountRequester.avatarKey}
                        isVerified={false}
                        isOpenAmount
                        message={charge?.requestLink?.reference ?? undefined}
                    />
                ) : (
                    recipient && (
                        <UserCard
                            type="send"
                            // the full address: the card's AddressLink shortens it, resolves
                            // its ENS name and links to it — a pre-shortened string breaks all three
                            username={
                                recipient.recipientType === 'ADDRESS' ? recipient.resolvedAddress : recipient.identifier
                            }
                            recipientType={recipient.recipientType}
                            isVerified={false}
                        />
                    )
                )}

                {/* amount input + its field error form one column, 4px apart */}
                <div className="flex flex-col gap-1">
                    <AmountInput
                        initialAmount={amount}
                        setPrimaryAmount={setAmount}
                        primaryDenomination={USD_DENOMINATION}
                        onSubmit={handleSubmit}
                        walletBalance={isLoggedIn ? formattedBalance : undefined}
                        balanceFillAmount={balanceFill}
                        hideBalance={!isLoggedIn}
                        hideCurrencyToggle={true}
                        // a charge fixes the amount, unless the requestee is asked to choose it
                        disabled={isAmountFromUrl || (!!chargeIdFromUrl && !charge?.openAmount)}
                    />
                    {isInsufficientBalance && <FieldError>{t('errors.insufficientPayment')}</FieldError>}
                </div>

                {/* button and error */}
                <div className="space-y-4">
                    <SendWithPeanutCta
                        onClick={handleSubmit}
                        disabled={isButtonDisabled}
                        loading={isLoading}
                        insufficientBalance={isInsufficientBalance}
                    />
                    {error.showError && (
                        <Callout priority="error">
                            <CooldownErrorText message={error.errorMessage} />
                        </Callout>
                    )}
                </div>

                <PaymentMethodActionList
                    // Only the signed-in requestee can set an open amount, so a
                    // signed-out visitor gets no wallet option here; the button
                    // above takes them to sign in and back.
                    onPayWithExternalWallet={
                        charge?.openAmount && !isLoggedIn ? undefined : handleOpenExternalWalletFlow
                    }
                    isAmountEntered={isAmountEntered}
                />
            </PageStack.Center>

            {/* support cta */}
            {!isLoggedIn && <SupportCTA />}
        </PageStack>
    )
}
