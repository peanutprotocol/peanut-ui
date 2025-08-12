'use client'

import { useState, useContext, useMemo, useEffect } from 'react'
import { Button } from '@/components/0_Bruddle'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import UserCard from '@/components/User/UserCard'
import GuestLoginCta from '@/components/Global/GuestLoginCta'
import AddressLink from '@/components/Global/AddressLink'
import ActionModal from '@/components/Global/ActionModal'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAccount } from 'wagmi'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { tokenSelectorContext } from '@/context'
import { formatAmount, areEvmAddressesEqual } from '@/utils'
import { formatUnits } from 'viem'
import {
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
} from '@/constants'
import type { TRequestChargeResponse } from '@/services/services.types'
import type { RequestPayPayload, PaymentRecipient } from '@/hooks/payment/types'
import { useRouter } from 'next/navigation'

interface RequestPayInitialProps {
    recipient?: string[]
    chargeDetails?: TRequestChargeResponse | null
    requestId?: string | null
    onSubmit: (payload: RequestPayPayload) => void
    onBack: () => void
    error?: string | null
    isCreatingCharge?: boolean
}

/**
 * RequestPayInitial - Initial view for request payment flow
 *
 * This component maintains the exact same UI as the legacy PaymentForm
 * but uses modern TanStack Query architecture underneath.
 *
 * Features:
 * - Token selection for external wallets
 * - Amount input (pre-filled from request)
 * - Wallet connection handling
 * - Balance validation
 * - Guest user handling
 */
export const RequestPayInitial = ({
    recipient,
    chargeDetails,
    requestId,
    onSubmit,
    onBack,
    error,
    isCreatingCharge = false,
}: RequestPayInitialProps) => {
    const router = useRouter()
    const { user } = useAuth()
    const { isConnected: isPeanutWallet, balance } = useWallet()
    const { isConnected: isExternalWallet, address: wagmiAddress } = useAccount()
    const { open: openWalletModal } = useAppKit()
    const { disconnect: disconnectWagmi } = useDisconnect()
    const {
        selectedTokenData,
        selectedChainID,
        selectedTokenAddress,
        selectedTokenBalance,
        setSelectedChainID,
        setSelectedTokenAddress,
        setSelectedTokenDecimals,
    } = useContext(tokenSelectorContext)

    const [inputTokenAmount, setInputTokenAmount] = useState<string>(chargeDetails?.tokenAmount || '')
    const [disconnectWagmiModal, setDisconnectWagmiModal] = useState<boolean>(false)
    const [balanceError, setBalanceError] = useState<string | null>(null)
    const [initialSetupDone, setInitialSetupDone] = useState(false)

    const isConnected = isPeanutWallet || isExternalWallet
    const isUsingExternalWallet = !isPeanutWallet
    const isActivePeanutWallet = useMemo(() => !!user && isPeanutWallet, [user, isPeanutWallet])

    // Format Peanut wallet balance for display
    const peanutWalletBalance = useMemo(() => {
        return formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
    }, [balance])

    // Initialize token selection from charge details
    useEffect(() => {
        if (initialSetupDone || !chargeDetails) return

        // Set up token/chain from charge details for external wallets
        if (chargeDetails.chainId && !isActivePeanutWallet) {
            setSelectedChainID(chargeDetails.chainId.toString())
        }

        if (chargeDetails.tokenAddress && !isActivePeanutWallet) {
            setSelectedTokenAddress(chargeDetails.tokenAddress)
            // Set decimals if available
            if (chargeDetails.tokenDecimals) {
                setSelectedTokenDecimals(chargeDetails.tokenDecimals)
            }
        }

        setInitialSetupDone(true)
    }, [
        chargeDetails,
        isActivePeanutWallet,
        initialSetupDone,
        setSelectedChainID,
        setSelectedTokenAddress,
        setSelectedTokenDecimals,
    ])

    // Balance validation effect
    useEffect(() => {
        setBalanceError(null)

        const currentInputAmountStr = String(inputTokenAmount)
        const parsedInputAmount = parseFloat(currentInputAmountStr.replace(/,/g, ''))

        if (!currentInputAmountStr || isNaN(parsedInputAmount) || parsedInputAmount <= 0) {
            return
        }

        try {
            if (isActivePeanutWallet && areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)) {
                // Peanut wallet payment
                const walletNumeric = parseFloat(String(peanutWalletBalance).replace(/,/g, ''))
                if (walletNumeric < parsedInputAmount) {
                    setBalanceError('Insufficient balance')
                }
            } else if (
                isExternalWallet &&
                !isActivePeanutWallet &&
                selectedTokenData &&
                selectedTokenBalance !== undefined
            ) {
                // External wallet payment
                if (selectedTokenData.decimals === undefined) {
                    setBalanceError('Cannot verify balance: token data incomplete.')
                    return
                }
                const numericSelectedTokenBalance = parseFloat(String(selectedTokenBalance).replace(/,/g, ''))
                if (numericSelectedTokenBalance < parsedInputAmount) {
                    setBalanceError('Insufficient balance')
                }
            }
        } catch (e) {
            console.error('Error during balance check:', e)
            setBalanceError('Error verifying balance')
        }
    }, [
        selectedTokenBalance,
        peanutWalletBalance,
        selectedTokenAddress,
        inputTokenAmount,
        isActivePeanutWallet,
        selectedTokenData,
        isExternalWallet,
    ])

    // Check if Peanut wallet USDC is selected
    const isPeanutWalletUSDC = useMemo(() => {
        return (
            selectedTokenData?.symbol === PEANUT_WALLET_TOKEN_SYMBOL &&
            Number(selectedChainID) === PEANUT_WALLET_CHAIN.id
        )
    }, [selectedTokenData, selectedChainID])

    // Determine if we can proceed with payment (like CryptoWithdrawFlow)
    const canProceed = useMemo(() => {
        if (!isConnected) return false
        if (!inputTokenAmount || parseFloat(inputTokenAmount) <= 0) return false
        if (balanceError) return false

        // For external wallets, need token selection
        if (isUsingExternalWallet && (!selectedTokenAddress || !selectedChainID)) return false

        // For Peanut wallet, always need token selection (destination)
        if (isActivePeanutWallet && (!selectedTokenAddress || !selectedChainID)) return false

        return true
    }, [
        isConnected,
        inputTokenAmount,
        isUsingExternalWallet,
        selectedTokenAddress,
        selectedChainID,
        balanceError,
        isActivePeanutWallet,
    ])

    const handleSubmit = () => {
        if (!canProceed) return

        // Convert recipient array to PaymentRecipient format for dynamic charge creation
        const recipientData: PaymentRecipient | undefined =
            recipient && recipient.length > 0
                ? {
                      identifier: recipient[0], // First element is the identifier
                      resolvedAddress: recipient[0], // For now, assume it's an address - will be resolved later
                      recipientType: 'ADDRESS' as const, // Default to ADDRESS, will be determined during processing
                  }
                : undefined

        const payload: RequestPayPayload = {
            // For existing charges/requests
            chargeId: chargeDetails?.uuid,
            requestId: requestId || undefined,
            tokenAmount: inputTokenAmount,

            // For dynamic charge creation (like CryptoWithdrawFlow)
            recipient: recipientData,
            selectedTokenAddress: selectedTokenAddress || undefined,
            selectedChainID: selectedChainID || undefined,
        }

        onSubmit(payload)
    }

    const handleConnectWallet = () => {
        if (!user) {
            // Guest user - redirect to setup
            router.push('/setup')
            return
        }
        openWalletModal()
    }

    // Guest user actions
    const guestAction = () => {
        if (isConnected || user) return null
        return (
            <div className="space-y-4">
                <Button variant="purple" shadowSize="4" onClick={() => router.push('/setup')} className="w-full">
                    Sign In
                </Button>
                <Button variant="primary-soft" shadowSize="4" onClick={() => openWalletModal()} className="w-full">
                    Connect Wallet
                </Button>
            </div>
        )
    }

    const displayError = error || balanceError

    return (
        <div className="flex h-full min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={onBack} title="Send" />

            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {/* External Wallet Switch Button */}
                {isExternalWallet && isUsingExternalWallet && (
                    <Button
                        icon="switch"
                        iconPosition="right"
                        variant="stroke"
                        size="small"
                        className="ml-auto h-7 w-fit rounded-sm bg-white hover:bg-white hover:text-black active:bg-white"
                        shadowSize="4"
                        iconClassName="min-h-2 h-2 min-w-2 w-2"
                        onClick={(e) => {
                            e.stopPropagation()
                            setDisconnectWagmiModal(true)
                        }}
                    >
                        <AddressLink
                            address={wagmiAddress ?? ''}
                            isLink={false}
                            className="text-xs font-medium text-black no-underline"
                        />
                    </Button>
                )}

                {/* Recipient Info Card */}
                {chargeDetails && (
                    <UserCard
                        type="send"
                        username={chargeDetails.requestLink.recipientAddress}
                        recipientType="ADDRESS" // Will be enhanced based on actual recipient type
                        size="small"
                        message={chargeDetails.requestLink.reference || ''}
                        fileUrl={chargeDetails.requestLink.attachmentUrl || ''}
                    />
                )}

                {/* Amount Input */}
                <TokenAmountInput
                    tokenValue={inputTokenAmount}
                    setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                    className="w-full"
                    disabled={!!chargeDetails?.tokenAmount} // Disable if amount is pre-set
                    walletBalance={isActivePeanutWallet ? peanutWalletBalance : undefined}
                />

                {/* Token Selector - Show for all connected users (like CryptoWithdrawFlow) */}
                {isConnected && (
                    <div className="space-y-2">
                        {!isPeanutWalletUSDC && !selectedTokenAddress && !selectedChainID && (
                            <div className="text-sm font-bold">
                                {isActivePeanutWallet
                                    ? 'Select token and chain to receive'
                                    : 'Select token and chain to send from'}
                            </div>
                        )}
                        <TokenSelector viewType="req_pay" />
                        {!isPeanutWalletUSDC && selectedTokenAddress && selectedChainID && (
                            <div className="pt-1 text-center text-xs text-grey-1">
                                <span>Use USDC on Arbitrum for free transactions!</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                    {/* Guest user actions */}
                    {guestAction()}

                    {/* Connected user actions */}
                    {isConnected && (
                        <Button
                            variant="purple"
                            shadowSize="4"
                            onClick={handleSubmit}
                            disabled={!canProceed || isCreatingCharge}
                            loading={isCreatingCharge}
                            className="w-full"
                            icon="arrow-up-right"
                            iconSize={16}
                        >
                            {isCreatingCharge ? 'Creating...' : 'Review'}
                        </Button>
                    )}

                    {/* Error display */}
                    {displayError && <ErrorAlert description={displayError} />}
                </div>
            </div>

            {/* Disconnect Wallet Modal */}
            <ActionModal
                visible={disconnectWagmiModal}
                onClose={() => setDisconnectWagmiModal(false)}
                title="Disconnect wallet?"
                description="You'll need to reconnect to continue using crypto features."
                icon="switch"
                ctaClassName="flex-row"
                hideModalCloseButton={true}
                ctas={[
                    {
                        text: 'Disconnect',
                        onClick: () => {
                            disconnectWagmi()
                            setDisconnectWagmiModal(false)
                        },
                        shadowSize: '4',
                    },
                    {
                        text: 'Cancel',
                        onClick: () => {
                            setDisconnectWagmiModal(false)
                        },
                        shadowSize: '4',
                        className: 'bg-grey-4 hover:bg-grey-4 hover:text-black active:bg-grey-4',
                    },
                ]}
            />
        </div>
    )
}
