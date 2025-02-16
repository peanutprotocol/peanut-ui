'use client'
import Modal from '@/components/Global/Modal'
import { TransactionBadge } from '@/components/Global/TransactionBadge'
import { supportedPeanutChains } from '@/constants'
import { IDashboardItem } from '@/interfaces'
import { copyTextToClipboardWithFallback, getExplorerUrl } from '@/utils'
import { usePrimaryName } from '@justaname.id/react'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Icon from '../Icon'

interface TokenBalance {
    chainId: string
    address: string
    name: string
    symbol: string
    decimals: number
    price: number
    amount: number
    currency: string
    logoURI: string
    value: string
}

export type TransactionType = 'Link Sent' | 'Link Received' | 'Money Requested' | 'Request paid' | 'Cash Out'

interface ListItemViewProps {
    id: string
    variant: 'history' | 'balance'
    primaryInfo: {
        title: string
        subtitle?: string
    }
    secondaryInfo: {
        mainText: string
        subText?: string
    }
    metadata: {
        tokenLogo?: string
        chainLogo?: string
        subText?: string
        recipientAddress?: string
        transactionType?: TransactionType
        recipientAddressFormatter?: (address: string) => string
    }
    details?: IDashboardItem | TokenBalance
}

const getTransactionStatus = (type: TransactionType | undefined, status: string | undefined): string => {
    if (!status || !type) return 'pending'

    switch (type) {
        case 'Link Sent':
            return ['claimed', 'pending', 'unclaimed'].includes(status.toLowerCase()) ? status : 'pending'
        case 'Link Received':
            return ['claimed', 'pending'].includes(status.toLowerCase()) ? status : 'pending'
        case 'Money Requested':
            return ['claimed', 'paid', 'canceled'].includes(status.toLowerCase()) ? status : 'pending'
        case 'Request paid':
            return ['claimed', 'paid'].includes(status.toLowerCase()) ? status : 'pending'
        case 'Cash Out':
            return ['pending', 'successful', 'error'].includes(status.toLowerCase()) ? status : 'pending'
        default:
            return status
    }
}

export const ListItemView = ({ id, variant, primaryInfo, secondaryInfo, metadata, details }: ListItemViewProps) => {
    const [modalVisible, setModalVisible] = useState(false)
    const isHistory = variant === 'history'
    const transactionDetails = isHistory ? (details as IDashboardItem) : null
    const balanceDetails = !isHistory ? (details as TokenBalance) : null
    const { primaryName } = usePrimaryName({
        address: metadata.recipientAddress,
    })
    const primaryNameOrAddress = useMemo(() => {
        return primaryName && primaryName !== '' ? primaryName : metadata.recipientAddress
    }, [primaryName, metadata.recipientAddress])

    // get the transaction status for history variant
    const transactionStatus =
        isHistory && metadata.transactionType
            ? getTransactionStatus(metadata.transactionType, transactionDetails?.status)
            : undefined

    return (
        <div
            className={twMerge(
                'flex w-full flex-row items-center justify-between gap-2 border border-b-0 border-n-1 bg-white p-3 text-h8 font-normal dark:bg-black',
                isHistory ? 'cursor-pointer' : ''
            )}
            key={id}
            onClick={() => isHistory && setModalVisible(true)}
        >
            <div className="relative mr-2 min-w-fit">
                {!!metadata.tokenLogo ? (
                    <Image src={metadata.tokenLogo} alt="token logo" width={32} height={32} className="rounded-full" />
                ) : (
                    <Icon name="token_placeholder" className="h-8 w-8" fill="#999" />
                )}

                {metadata.chainLogo && (
                    <Image
                        src={metadata.chainLogo}
                        alt="chain logo"
                        width={16}
                        height={16}
                        className="absolute -right-2 bottom-0 size-4 rounded-full"
                    />
                )}
            </div>

            <div className="flex w-full flex-col gap-2">
                <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex w-full items-center gap-2">
                        <div className="flex items-center gap-2">
                            <label className="font-bold">{primaryInfo.title}</label>
                            {primaryInfo.subtitle && <label className="text-xs text-n-3">{primaryInfo.subtitle}</label>}
                        </div>
                        {isHistory && transactionStatus && (
                            <div className="flex flex-col items-end justify-end gap-2 text-end">
                                <TransactionBadge status={transactionStatus} />
                            </div>
                        )}
                    </div>
                    <label className="font-bold">{secondaryInfo.mainText}</label>
                </div>
                {(primaryNameOrAddress || metadata.subText || secondaryInfo.subText) && (
                    <div className="flex w-full flex-row items-center justify-between">
                        <div className="flex flex-col items-start justify-end gap-2 text-start">
                            {primaryNameOrAddress && (
                                <label className="text-xs font-normal text-n-3">
                                    {metadata?.recipientAddressFormatter
                                        ? metadata.recipientAddressFormatter(primaryNameOrAddress)
                                        : primaryNameOrAddress}
                                </label>
                            )}
                            {secondaryInfo.subText && (
                                <label className="text-xs font-normal text-n-3">{secondaryInfo.subText}</label>
                            )}
                        </div>
                        {metadata.subText && (
                            <div>
                                <label className="text-xs font-normal">{metadata.subText}</label>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* modal only for history variant */}
            {isHistory && transactionDetails && (
                <Modal
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    title="Options"
                    classWrap="bg-background"
                >
                    <div className="flex w-full flex-col items-center justify-center px-2"></div>
                    {transactionDetails?.type !== 'Link Received' &&
                        transactionDetails?.type !== 'Request Link' &&
                        transactionDetails?.status === 'pending' && (
                            <div
                                onClick={() => {
                                    transactionDetails.link &&
                                        window.open(transactionDetails?.link ?? '', '_blank', 'noopener,noreferrer')
                                }}
                                className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                            >
                                Refund
                            </div>
                        )}
                    {(transactionDetails?.type === 'Link Received' ||
                        transactionDetails?.type === 'Link Sent' ||
                        transactionDetails?.type === 'Request Link') && (
                        <div
                            onClick={() => {
                                copyTextToClipboardWithFallback(transactionDetails?.link ?? '')
                            }}
                            className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            Copy link
                        </div>
                    )}
                    {transactionDetails?.txHash && (
                        <div
                            onClick={() => {
                                const chainId =
                                    supportedPeanutChains.find((chain) => chain.name === transactionDetails?.chain)
                                        ?.chainId ?? ''

                                const explorerUrl = getExplorerUrl(chainId)
                                window.open(
                                    `${explorerUrl}/tx/${transactionDetails?.txHash ?? ''}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                )
                            }}
                            className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            Show in explorer
                        </div>
                    )}
                    {transactionDetails?.attachmentUrl && (
                        <a
                            href={transactionDetails.attachmentUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            Download attachment
                        </a>
                    )}
                    {transactionDetails?.type === 'Offramp Claim' && transactionDetails.status !== 'claimed' && (
                        <a
                            href={(() => {
                                const url = new URL(transactionDetails?.link ?? '')
                                url.pathname = '/cashout/status'
                                return url.toString()
                            })()}
                            target="_blank"
                            className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            Check Status
                        </a>
                    )}
                </Modal>
            )}
        </div>
    )
}
