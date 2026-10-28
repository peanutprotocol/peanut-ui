'use client'

import NavHeader from '@/components/Global/NavHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Callout } from '@/components/0_Bruddle/Callout'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import TokenListItem from '@/components/Global/TokenSelector/Components/TokenListItem'
import DisplayIcon from '@/components/Global/DisplayIcon'
import type { RecoverableBalance } from '@/types/recover-funds'
import { useState, useCallback, useContext } from 'react'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useRecoverableBalances } from '@/hooks/useRecoverableBalances'
import { nativeCurrencyAddresses } from '@/constants/general.consts'
import { areEvmAddressesEqual, isTxReverted, getExplorerUrl, getChainName } from '@/utils/general.utils'
import { type RecipientState } from '@/components/Global/GeneralRecipientInput/types'
import GeneralRecipientInput, { type GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Card from '@/components/Global/Card'
import AddressLink from '@/components/Global/AddressLink'
import Loading from '@/components/Global/Loading'
import { erc20Abi, encodeFunctionData } from 'viem'
import type { Address, Hash, TransactionReceipt } from 'viem'
import { useRouter } from 'next/navigation'
import { loadingStateContext } from '@/context/loadingStates.context'
import { captureException } from '@sentry/nextjs'
import { getPublicClient, type ChainId } from '@/app/actions/clients'
import { useFormatter, useTranslations } from 'next-intl'
import { loadingStateKey } from '@/i18n/app/loading-states'

// Helper function to check if a token is native ETH
const isNativeToken = (tokenAddress: string): boolean => {
    return nativeCurrencyAddresses.some((nativeAddr) => areEvmAddressesEqual(nativeAddr, tokenAddress))
}

// the native balance is read again at send time, so a balance that moved
// since the list loaded is still sent in full
const fetchExactNativeBalance = async (chainId: string, address: Address): Promise<bigint> => {
    const client = getPublicClient(Number(chainId) as ChainId)
    return await client.getBalance({ address })
}

export default function RecoverFundsPage() {
    const [selectedBalance, setSelectedBalance] = useState<RecoverableBalance | undefined>()
    const [recipient, setRecipient] = useState<RecipientState>({ address: '', name: '' })
    const [errorMessage, setErrorMessage] = useState('')
    const [inputChanging, setInputChanging] = useState(false)
    const [isSigning, setIsSigning] = useState(false)
    const [txHash, setTxHash] = useState<string>('')
    const [status, setStatus] = useState<'init' | 'review' | 'final'>('init')
    const { address: peanutAddress, sendTransactions } = useWallet()
    const router = useRouter()
    const { loadingState, isLoading } = useContext(loadingStateContext)
    const t = useTranslations('recoverFunds')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const format = useFormatter()
    // Balance discovery + failure semantics live in the hook so they are
    // testable (TASK-21829): fetch failure → retryable error state, never a
    // false "no tokens to recover".
    const { tokenBalances, setTokenBalances, fetchingBalances, balancesError, retry } =
        useRecoverableBalances(peanutAddress)

    const reset = useCallback(() => {
        setErrorMessage('')
        setInputChanging(false)
        setIsSigning(false)
        setTxHash('')
        setStatus('init')
        setRecipient({ address: '', name: '' })
        setSelectedBalance(undefined)
    }, [])

    const recoverFunds = useCallback(async () => {
        if (!selectedBalance || !recipient.address || !peanutAddress) return
        setIsSigning(true)
        setErrorMessage('')

        let receipt: TransactionReceipt | null
        let userOpHash: Hash

        try {
            // Check if the token is native ETH
            if (isNativeToken(selectedBalance.address)) {
                // native coin: the exact balance at send time, in wei
                const exactBalance = await fetchExactNativeBalance(selectedBalance.chainId, peanutAddress as Address)
                const result = await sendTransactions(
                    [
                        {
                            to: recipient.address as Address,
                            value: exactBalance,
                        },
                    ],
                    selectedBalance.chainId
                )
                receipt = result.receipt
                userOpHash = result.userOpHash
            } else {
                // ERC-20: the exact on-chain balance read for the list, never a
                // float round-trip that could ask for more than the account holds
                const data = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [recipient.address as Address, selectedBalance.rawAmount],
                })
                const result = await sendTransactions([{ to: selectedBalance.address, data }], selectedBalance.chainId)
                receipt = result.receipt
                userOpHash = result.userOpHash
            }
        } catch (error) {
            console.error('Error recovering funds:', error)
            captureException(error)
            // Handle specific error cases
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes('No client found')) {
                const chainName =
                    getChainName(selectedBalance.chainId) ?? t('unknownChain', { chainId: selectedBalance.chainId })
                setErrorMessage(t('recoveryUnavailable', { chain: chainName }))
            } else if (errorMessage.includes('session has expired')) {
                setErrorMessage(t('sessionExpired'))
            } else {
                setErrorMessage(t('sendFailed'))
            }
            setIsSigning(false)
            return
        }
        if (receipt !== null && isTxReverted(receipt)) {
            setErrorMessage(t('txReverted'))
            setIsSigning(false)
            return
        }
        setTxHash(receipt?.transactionHash ?? userOpHash)
        setStatus('final')
        setIsSigning(false)
    }, [selectedBalance, recipient.address, sendTransactions, peanutAddress, t])

    // wallet address not resolved yet (kernel still initializing) — show the
    // loader instead of a blank page; balances start fetching once it lands
    if (!peanutAddress || fetchingBalances) {
        return <Loading variant="mascot" />
    }

    if (status === 'review' && (!selectedBalance || !recipient.address)) {
        captureException(new Error('Invalid state, review without selected balance or recipient address'))
        reset()
        return null
    } else if (status === 'review') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={reset} />
                <PageStack.Center className="gap-4">
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={
                                    'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-green-500 font-bold'
                                }
                            >
                                <DisplayIcon
                                    iconUrl={selectedBalance!.logoURI}
                                    altText={t('tokenLogoAlt', { symbol: selectedBalance!.symbol })}
                                    fallbackName={selectedBalance!.symbol}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-body-s font-normal text-foreground-secondary">
                                {t('youWillReceiveTo')}{' '}
                                <AddressLink
                                    inline
                                    address={recipient.address}
                                    className="text-body-s font-normal text-foreground-secondary"
                                />
                            </h1>
                            <h2 className="text-heading-s">
                                {t('amountInChain', {
                                    amount: format.number(selectedBalance!.amount, { maximumFractionDigits: 8 }),
                                    symbol: selectedBalance!.symbol,
                                    chain:
                                        getChainName(selectedBalance!.chainId) ??
                                        t('unknownChain', { chainId: selectedBalance!.chainId }),
                                })}
                            </h2>
                        </div>
                    </Card>
                    <Button
                        variant="primary"
                        shadowSize="4"
                        onClick={recoverFunds}
                        disabled={isLoading || isSigning}
                        loading={isLoading || isSigning}
                        className="w-full"
                    >
                        {isLoading ? tLoading(loadingStateKey(loadingState)) : tCommon('confirm')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    if (status === 'final') {
        return (
            <PageStack>
                <PageStack.Center className="gap-4">
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={
                                    'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-green-500 font-bold'
                                }
                            >
                                {/* a token from Rhino's list can come without a logo: initials then */}
                                <DisplayIcon
                                    iconUrl={selectedBalance!.logoURI}
                                    altText={t('tokenLogoAlt', { symbol: selectedBalance!.symbol })}
                                    fallbackName={selectedBalance!.symbol}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-body-s font-normal text-foreground-secondary">
                                {t('sentTo')}{' '}
                                <AddressLink
                                    inline
                                    address={recipient.address}
                                    className="text-body-s font-normal text-foreground-secondary"
                                />
                            </h1>
                            <h2 className="text-heading-s">
                                {t('amountInChain', {
                                    amount: format.number(selectedBalance!.amount, { maximumFractionDigits: 8 }),
                                    symbol: selectedBalance!.symbol,
                                    chain:
                                        getChainName(selectedBalance!.chainId) ??
                                        t('unknownChain', { chainId: selectedBalance!.chainId }),
                                })}
                            </h2>
                            <LinkButton href={`${getExplorerUrl(selectedBalance!.chainId)}/tx/${txHash}`} external icon>
                                {t('viewOnExplorer')}
                            </LinkButton>
                        </div>
                    </Card>
                    <Button
                        variant="primary"
                        shadowSize="4"
                        onClick={() => {
                            router.push('/home')
                        }}
                        className="w-full"
                    >
                        {t('goToHome')}
                    </Button>
                    <Button
                        variant="secondary"
                        shadowSize="4"
                        onClick={() => {
                            setTokenBalances(
                                tokenBalances.filter(
                                    (b) =>
                                        !(
                                            areEvmAddressesEqual(b.address, selectedBalance!.address) &&
                                            b.chainId === selectedBalance!.chainId
                                        )
                                )
                            )
                            reset()
                        }}
                        className="w-full"
                    >
                        {t('recoverOtherToken')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} />
            {/* balancesError: the fetch failed — show the alert empty state
                with a retry instead of hanging on the loader (TASK-21829).
                Otherwise, nothing recoverable — the token picker, address
                input and review button are all pointless, show the ds empty
                state with a way back home instead */}
            {balancesError || tokenBalances.length === 0 ? (
                <div className="my-auto">
                    <EmptyState
                        icon={balancesError ? 'alert' : 'wallet'}
                        iconColor={balancesError ? 'red' : 'gray'}
                        title={balancesError ? tCommon('somethingWentWrong') : t('noTokens')}
                        description={balancesError ? tCommon('genericError') : t('noTokensDescription')}
                        cta={
                            <Button
                                variant="primary"
                                shadowSize="4"
                                size="small"
                                className="mt-2"
                                onClick={() => (balancesError ? retry() : router.push('/home'))}
                            >
                                {balancesError ? tCommon('tryAgain') : t('goToHome')}
                            </Button>
                        }
                    />
                </div>
            ) : (
                <PageStack.Center className="gap-4">
                    <h1>{t('selectToken')}</h1>
                    <ListGroup role="listbox" aria-label={t('selectToken')}>
                        {tokenBalances.map((balance) => (
                            <TokenListItem
                                key={`${balance.chainId}-${balance.address}`}
                                balance={balance}
                                showBalance
                                isSelected={
                                    !!selectedBalance &&
                                    areEvmAddressesEqual(balance.address, selectedBalance?.address) &&
                                    balance.chainId === selectedBalance?.chainId
                                }
                                onClick={() => {
                                    setSelectedBalance(balance)
                                }}
                            />
                        ))}
                    </ListGroup>
                    <GeneralRecipientInput
                        placeholder={t('recipientPlaceholder')}
                        recipient={recipient}
                        onUpdate={(update: GeneralRecipientUpdate) => {
                            setRecipient(update.recipient)
                            setErrorMessage(update.errorMessage)
                            setInputChanging(update.isChanging)
                        }}
                    />
                    <Button
                        variant="primary"
                        shadowSize="4"
                        onClick={() => {
                            setStatus('review')
                        }}
                        disabled={
                            !!errorMessage ||
                            inputChanging ||
                            !recipient.address ||
                            !selectedBalance ||
                            selectedBalance.amount <= 0
                        }
                        loading={false}
                        className="w-full"
                    >
                        {t('review')}
                    </Button>
                    {!!errorMessage && <Callout priority="error">{errorMessage}</Callout>}
                </PageStack.Center>
            )}
        </PageStack>
    )
}
