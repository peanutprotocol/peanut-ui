'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import GeneralRecipientInput, { type GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import { useWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { type ITokenPriceData } from '@/interfaces/interfaces'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useMemo, useRef } from 'react'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { addressFamilyForChainId } from '@/lib/validation/addressFamily'
import { printableAddress } from '@/utils/general.utils'
import { useTranslations } from 'next-intl'
import { withdrawChainRecord } from '../chain-record'
import { useEnsRecipientForChain } from '../useEnsRecipientForChain'

interface InitialWithdrawViewProps {
    onContinue: (data: { token: ITokenPriceData; chain: ChainWithTokens; address: string }) => void
    onBack?: () => void
    isProcessing?: boolean
    /** Reached via Send → Exchange or Wallet, so the copy says send, not withdraw. */
    isFromSendFlow?: boolean
}

export default function InitialWithdrawView({
    onContinue,
    onBack,
    isProcessing,
    isFromSendFlow = false,
}: InitialWithdrawViewProps) {
    const { withdrawData } = useWithdrawFlow()
    const t = useTranslations('withdraw')
    const tCommon = useTranslations('common')
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
        networkUnconfirmed,
        setNetworkUnconfirmed,
        error,
        setError,
    } = useWithdrawFlow()

    const recipientAddressRef = useRef(recipient.address)
    recipientAddressRef.current = recipient.address

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

    // ENS names resolve per destination chain (ENSIP-11): a typed name
    // re-resolves when the user switches chains. Kept out of the error-clearing
    // effect above: its error.showError dep would abort an in-flight resolution.
    useEnsRecipientForChain(selectedChainID, addressFamily)

    const handleContinue = () => {
        const selectedChainData = withdrawChainRecord(supportedChainsAndTokens, selectedChainID)

        if (selectedTokenData && selectedChainData && recipient.address) {
            onContinue({
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
        } else if (!(isValidRecipient && recipient.address)) {
            // otherwise, set defaults for a fresh entry. An address-book tap
            // arrives with the destination prefilled and its chain + token
            // already selected — resetting here would silently move an EVM
            // address onto the Peanut wallet chain (and clear non-EVM ones via
            // the family-change effect), sending funds on the wrong network.
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        // flex/gap shell per the page-layout rules — space-y on the outer div
        // conflicts with centering and clipped the CTA on short viewports
        <PageStack>
            <NavHeader title={isFromSendFlow ? tNav('send') : tNav('withdraw')} onPrev={onBack || defaultOnBack} />

            <div className="space-y-4">
                <TokenSelector
                    viewType="withdraw"
                    // never send to a network moved under a prefilled destination silently
                    onAutoCorrect={() => {
                        if (recipientAddressRef.current) setNetworkUnconfirmed(true)
                    }}
                    // a token tap keeps the default network, so only a network pick confirms it
                    onNetworkSelect={() => setNetworkUnconfirmed(false)}
                    // guidance, not an error: the address is fine, the network is still the user's call
                    networkHelper={networkUnconfirmed ? t('initial.confirmNetwork') : undefined}
                />

                {/* input + its field error form one column, 4px apart (form-field board 17788:19179) */}
                <div className="flex flex-col gap-1">
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
                    {error.showError && !!error.errorMessage && <FieldError>{error.errorMessage}</FieldError>}
                </div>

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
                    variant="primary"
                    shadowSize="4"
                    onClick={handleContinue}
                    disabled={
                        !selectedTokenData ||
                        !selectedChainID ||
                        !recipient.address ||
                        !isValidRecipient ||
                        error.showError ||
                        inputChanging ||
                        networkUnconfirmed ||
                        isProcessing
                    }
                    loading={isProcessing}
                    className="w-full"
                >
                    {tCommon('continue')}
                </Button>
            </div>
        </PageStack>
    )
}
