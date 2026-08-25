'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import GeneralRecipientInput, { type GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { type ITokenPriceData } from '@/interfaces/interfaces'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { formatAmount, printableAddress } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useMemo, useRef } from 'react'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { addressFamilyForChainId } from '@/lib/validation/addressFamily'
import { useTranslations } from 'next-intl'
import { validateAndResolveRecipient } from '@/lib/validation/recipient'

interface InitialWithdrawViewProps {
    amount: string
    onReview: (data: { token: ITokenPriceData; chain: ChainWithTokens; address: string }) => void
    onBack?: () => void
    isProcessing?: boolean
    /** Reached via Send → Exchange or Wallet, so the copy says send, not withdraw. */
    isFromSendFlow?: boolean
}

export default function InitialWithdrawView({
    amount,
    onReview,
    onBack,
    isProcessing,
    isFromSendFlow = false,
}: InitialWithdrawViewProps) {
    const { usdAmount, withdrawData } = useWithdrawFlow()
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const router = useRouter()
    const {
        selectedTokenData,
        selectedChainID,
        supportedChainsAndTokens,
        setSelectedChainID,
        setSelectedTokenAddress,
    } = useContext(tokenSelectorContext)

    const {
        isValidRecipient,
        setIsValidRecipient,
        inputChanging,
        setInputChanging,
        recipient,
        setRecipient,
        error,
        setError,
    } = useWithdrawFlow()

    // Non-EVM destinations (Solana/Tron) drive the recipient input's address
    // family; changing family invalidates whatever address was typed.
    const addressFamily = useMemo(() => addressFamilyForChainId(selectedChainID), [selectedChainID])
    const prevFamilyRef = useRef(addressFamily)
    useEffect(() => {
        if (prevFamilyRef.current !== addressFamily) {
            prevFamilyRef.current = addressFamily
            setRecipient({ name: undefined, address: '' })
            setIsValidRecipient(false)
        }
    }, [addressFamily, setRecipient, setIsValidRecipient])

    // Changing the destination chain invalidates chain-scoped errors (e.g. the
    // per-network minimum block from review, which says "pick a different
    // network") — without this the stale error keeps Review disabled after the
    // user follows that instruction. Safe for address errors too: Review stays
    // gated by isValidRecipient regardless of the error banner.
    const prevChainRef = useRef(selectedChainID)
    useEffect(() => {
        if (prevChainRef.current !== selectedChainID) {
            prevChainRef.current = selectedChainID
            if (error.showError) setError({ showError: false, errorMessage: '' })
        }
    }, [selectedChainID, error.showError, setError])

    // ENS names resolve per destination chain (ENSIP-11) — a validated name
    // must re-resolve when the user switches chains after typing it, or the
    // withdraw would go to the previous chain's address. Kept separate from the
    // error-clearing effect above: its error.showError dep would abort an
    // in-flight resolution via this cleanup.
    const prevResolvedChainRef = useRef(selectedChainID)
    useEffect(() => {
        if (prevResolvedChainRef.current === selectedChainID) return
        prevResolvedChainRef.current = selectedChainID
        if (addressFamily !== 'evm' || !recipient.name) return

        const name = recipient.name
        // Gate Review while the previous chain's address is still in state —
        // clicking it mid-resolution would send to that address.
        setIsValidRecipient(false)
        let stale = false
        validateAndResolveRecipient(name, true, 'evm', selectedChainID)
            .then((validation) => {
                if (stale) return
                setRecipient({ name, address: validation.resolvedAddress })
                setIsValidRecipient(true)
            })
            .catch(() => {
                if (stale) return
                setRecipient({ name: undefined, address: '' })
                setIsValidRecipient(false)
                setError({
                    showError: true,
                    errorMessage: 'Could not resolve the ENS name for the selected network',
                })
            })
        return () => {
            stale = true
        }
    }, [selectedChainID, addressFamily, recipient.name, setRecipient, setIsValidRecipient, setError])

    const handleReview = () => {
        // Context record already includes the synthetic non-EVM withdraw
        // destinations (merged once in tokenSelector.context).
        const xchainChainData = supportedChainsAndTokens[selectedChainID]
        // supportedChainsAndTokens may not list the Peanut wallet chain on
        // testnets / env-configured chains. Synthesize a minimal entry so the
        // same-chain (no-bridge) path can proceed.
        const isPeanutWalletChain = selectedChainID === PEANUT_WALLET_CHAIN.id.toString()
        const fallbackChainData =
            isPeanutWalletChain && !xchainChainData
                ? ({
                      chainId: PEANUT_WALLET_CHAIN.id.toString(),
                      networkName: PEANUT_WALLET_CHAIN.name,
                      chainIconURI: '',
                      tokens: [],
                  } satisfies ChainWithTokens)
                : undefined
        const selectedChainData = xchainChainData ?? fallbackChainData

        if (selectedTokenData && selectedChainData && recipient.address) {
            onReview({
                token: selectedTokenData,
                chain: selectedChainData,
                address: recipient.address,
            })
        } else {
            setError({
                showError: true,
                errorMessage: t('initial.detailsMissing'),
            })
            console.error('Token, chain, or address not selected/entered', {
                hasToken: !!selectedTokenData,
                hasChain: !!selectedChainData,
                hasAddress: !!recipient.address,
                selectedChainID,
            })
        }
    }

    const defaultOnBack = () => {
        router.push('/withdraw')
    }

    useEffect(() => {
        // if withdrawData exists (user clicked back from confirm), preserve their selection
        if (withdrawData?.chain && withdrawData?.token) {
            setSelectedChainID(withdrawData.chain.chainId)
            setSelectedTokenAddress(withdrawData.token.address)
        } else {
            // otherwise, set defaults for new withdraw flow
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [])

    return (
        // flex/gap shell per the page-layout rules — space-y on the outer div
        // conflicts with centering and clipped the CTA on short viewports
        <PageStack>
            <NavHeader title={isFromSendFlow ? tNav('send') : tNav('withdraw')} onPrev={onBack || defaultOnBack} />

            <div className="space-y-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType={'WITHDRAW'}
                    recipientType="USERNAME"
                    recipientName={''}
                    amount={`${formatAmount(parseFloat(usdAmount || amount))}`}
                    tokenSymbol="USDC"
                    isFromSendFlow={isFromSendFlow}
                />

                <TokenSelector viewType="withdraw" />

                <GeneralRecipientInput
                    placeholder={
                        addressFamily === 'evm' ? t('initial.placeholderEns') : t('initial.placeholderAddress')
                    }
                    addressFamily={addressFamily}
                    chainId={selectedChainID}
                    recipient={recipient}
                    onUpdate={(update: GeneralRecipientUpdate) => {
                        setRecipient(update.recipient)
                        setIsValidRecipient(update.isValid)
                        setError({
                            showError: !update.isValid,
                            errorMessage: update.errorMessage,
                        })
                        setInputChanging(update.isChanging)
                    }}
                    showInfoText={false}
                    isWithdrawal
                />

                {/* Surface the resolved address as soon as an ENS name validates —
                    the user must see where funds will actually go before any
                    review/warning step (external tester feedback). */}
                {!!recipient.name && !!recipient.address && isValidRecipient && !inputChanging && (
                    <p className="text-left text-body-xs text-foreground-secondary">
                        {recipient.name} {t('resolvesTo')}{' '}
                        <span className="font-mono">{printableAddress(recipient.address)}</span>
                    </p>
                )}

                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={handleReview}
                    disabled={
                        !selectedTokenData ||
                        !selectedChainID ||
                        !recipient.address ||
                        !isValidRecipient ||
                        error.showError ||
                        inputChanging ||
                        isProcessing
                    }
                    loading={isProcessing}
                    className="w-full"
                >
                    {t('review')}
                </Button>

                {error.showError && !!error.errorMessage && (
                    <Notification priority="error">{error.errorMessage}</Notification>
                )}
            </div>
        </PageStack>
    )
}
