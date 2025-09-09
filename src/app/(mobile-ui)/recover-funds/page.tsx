'use client'

import NavHeader from '@/components/Global/NavHeader'
import ScrollableList from '@/components/Global/TokenSelector/Components/ScrollableList'
import TokenListItem from '@/components/Global/TokenSelector/Components/TokenListItem'
import { IUserBalance } from '@/interfaces'
import { useState, useEffect, useMemo, useCallback, useContext } from 'react'
import { useWallet } from '@/hooks/wallet/useWallet'
import { fetchWalletBalances } from '@/app/actions/tokens'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { areEvmAddressesEqual, isTxReverted, getExplorerUrl } from '@/utils'
import { RecipientState } from '@/context/WithdrawFlowContext'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import Card from '@/components/Global/Card'
import Image from 'next/image'
import AddressLink from '@/components/Global/AddressLink'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { erc20Abi, parseUnits, encodeFunctionData } from 'viem'
import type { Address, Hash, TransactionReceipt } from 'viem'
import { useRouter } from 'next/navigation'
import { loadingStateContext } from '@/context'
import Icon from '@/components/Global/Icon'
import { captureException } from '@sentry/nextjs'

export default function RecoverFundsPage() {
    const [tokenBalances, setTokenBalances] = useState<IUserBalance[]>([])
    const [selectedTokenAddress, setSelectedTokenAddress] = useState('')
    const [recipient, setRecipient] = useState<RecipientState>({ address: '', name: '' })
    const [errorMessage, setErrorMessage] = useState('')
    const [inputChanging, setInputChanging] = useState(false)
    const [fetchingBalances, setFetchingBalances] = useState(true)
    const [isSigning, setIsSigning] = useState(false)
    const [txHash, setTxHash] = useState<string>('')
    const [status, setStatus] = useState<'init' | 'review' | 'final'>('init')
    const { address: peanutAddress, sendTransactions } = useWallet()
    const router = useRouter()
    const { loadingState, isLoading } = useContext(loadingStateContext)

    useEffect(() => {
        if (!peanutAddress) return
        setFetchingBalances(true)
        fetchWalletBalances(peanutAddress)
            .then((balances) => {
                const nonUsdcArbitrumBalances = balances.balances.filter(
                    (b) =>
                        b.chainId === PEANUT_WALLET_CHAIN.id.toString() &&
                        !areEvmAddressesEqual(PEANUT_WALLET_TOKEN, b.address)
                )
                setTokenBalances(nonUsdcArbitrumBalances)
            })
            .finally(() => {
                setFetchingBalances(false)
            })
    }, [peanutAddress])

    const selectedBalance = useMemo<IUserBalance | undefined>(() => {
        if (selectedTokenAddress === '') return undefined
        return tokenBalances.find((b) => areEvmAddressesEqual(b.address, selectedTokenAddress))
    }, [tokenBalances, selectedTokenAddress])

    const reset = useCallback(() => {
        setErrorMessage('')
        setInputChanging(false)
        setIsSigning(false)
        setTxHash('')
        setStatus('init')
        setRecipient({ address: '', name: '' })
        setSelectedTokenAddress('')
    }, [])

    const recoverFunds = useCallback(async () => {
        if (!selectedBalance || !recipient.address) return
        setIsSigning(true)
        setErrorMessage('')
        const amountStr = selectedBalance.amount.toFixed(selectedBalance.decimals)
        const amount = parseUnits(amountStr, selectedBalance.decimals)
        const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipient.address as Address, amount],
        })
        let receipt: TransactionReceipt | null
        let userOpHash: Hash
        try {
            const result = await sendTransactions([{ to: selectedBalance.address, data }])
            receipt = result.receipt
            userOpHash = result.userOpHash
        } catch (error) {
            setErrorMessage('Error sending transaction, please try again')
            setIsSigning(false)
            return
        }
        if (receipt !== null && isTxReverted(receipt)) {
            setErrorMessage('Transaction reverted, please try again')
            setIsSigning(false)
            return
        }
        setTxHash(receipt?.transactionHash ?? userOpHash)
        setStatus('final')
        setIsSigning(false)
    }, [selectedBalance, recipient.address, sendTransactions])

    if (!peanutAddress) return null

    if (fetchingBalances) {
        return <PeanutLoading />
    }

    if (status === 'review' && (!selectedBalance || !recipient.address)) {
        captureException(new Error('Invalid state, review without selected balance or recipient address'))
        reset()
        return null
    } else if (status === 'review') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Recover Funds" onPrev={reset} />
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={
                                    'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold'
                                }
                            >
                                <Image
                                    src={selectedBalance!.logoURI}
                                    alt={`${selectedBalance!.symbol} logo`}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-sm font-normal text-grey-1">
                                You will receive to <AddressLink address={recipient.address} />
                            </h1>
                            <h2 className="text-2xl font-extrabold">
                                {selectedBalance!.amount} {selectedBalance!.symbol} in Arbitrum
                            </h2>
                        </div>
                    </Card>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={recoverFunds}
                        disabled={isLoading || isSigning}
                        loading={isLoading || isSigning}
                        className="w-full"
                    >
                        {isLoading ? loadingState : 'Confirm'}
                    </Button>
                </div>
            </div>
        )
    }

    if (status === 'final') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <div className="my-auto flex h-full flex-col justify-center space-y-4">
                    <Card className="flex items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={
                                    'flex h-12 w-12 min-w-12 items-center justify-center rounded-full bg-success-3 font-bold'
                                }
                            >
                                <Image
                                    src={selectedBalance!.logoURI}
                                    alt={`${selectedBalance!.symbol} logo`}
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-sm font-normal text-grey-1">
                                Sent to <AddressLink address={recipient.address} />
                            </h1>
                            <h2 className="text-2xl font-extrabold">
                                {selectedBalance!.amount} {selectedBalance!.symbol} in Arbitrum
                            </h2>
                            <a
                                href={`${getExplorerUrl(selectedBalance!.chainId)}/tx/${txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 hover:underline"
                            >
                                <span>View on explorer</span>
                                <Icon name="external-link" />
                            </a>
                        </div>
                    </Card>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={() => {
                            router.push('/home')
                        }}
                        className="w-full"
                    >
                        Go to home
                    </Button>
                    <Button
                        variant="stroke"
                        shadowSize="4"
                        onClick={() => {
                            setTokenBalances(tokenBalances.filter((b) => b.address !== selectedTokenAddress))
                            reset()
                        }}
                        className="w-full"
                    >
                        Recover other token
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Recover Funds" />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <h1> Select a token to recover </h1>
                <ScrollableList>
                    {tokenBalances.length > 0 ? (
                        tokenBalances.map((balance) => (
                            <TokenListItem
                                key={balance.address}
                                balance={balance}
                                isSelected={areEvmAddressesEqual(balance.address, selectedTokenAddress)}
                                onClick={() => {
                                    setSelectedTokenAddress(balance.address)
                                }}
                            />
                        ))
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <div className="text-center text-xl font-bold text-grey-1">No tokens to recover</div>
                        </div>
                    )}
                </ScrollableList>
                <GeneralRecipientInput
                    placeholder="Enter the address where you want to receive the funds"
                    recipient={recipient}
                    onUpdate={(update: GeneralRecipientUpdate) => {
                        setRecipient(update.recipient)
                        setErrorMessage(update.errorMessage)
                        setInputChanging(update.isChanging)
                    }}
                />
                <Button
                    variant="purple"
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
                    Review
                </Button>
                {!!errorMessage && <ErrorAlert description={errorMessage} />}
            </div>
        </div>
    )
}
