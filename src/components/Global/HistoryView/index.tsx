'use client'
import { ARBITRUM_ICON } from '@/assets'
import Modal from '@/components/Global/Modal'
import { TransactionBadge } from '@/components/Global/TransactionBadge'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import Image from 'next/image'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface HistoryViewProps {
    id: string
    transactionType: string
    amount: string
    recipientAddress: string
    status: string
    transactionDetails: interfaces.IDashboardItem
}

const getTransactionStatus = (type: string, status: string | undefined): string => {
    if (!status) return 'pending'

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

export const HistoryView = ({
    id,
    transactionType,
    amount,
    recipientAddress,
    status,
    transactionDetails,
}: HistoryViewProps) => {
    const [modalVisible, setModalVisible] = useState(false)
    const transactionStatus = getTransactionStatus(transactionType, transactionDetails.status)

    return (
        <div
            className={twMerge(
                'flex w-full cursor-pointer flex-row items-center justify-between gap-2 border border-b-0 border-n-1 bg-white p-3 text-h8 font-normal dark:bg-black'
            )}
            key={id}
            onClick={() => setModalVisible(true)}
        >
            {/* todo: replace with orignal token logos, rn details not available */}
            <div className="relative mr-2 min-w-fit">
                {transactionDetails?.tokenSymbol === 'USDC' && (
                    <Image
                        src={'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040'}
                        alt="token logo"
                        width={30}
                        height={30}
                        className="rounded-full"
                    />
                )}

                {transactionDetails?.tokenSymbol === 'USDC' && transactionDetails.chain === 'Arbitrum One' && (
                    <Image
                        src={ARBITRUM_ICON}
                        alt="token logo"
                        width={16}
                        height={16}
                        className="absolute -right-2 bottom-0 size-4 rounded-full"
                    />
                )}
            </div>

            <div className="flex w-full flex-col gap-2" key={id}>
                <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex w-full max-w-48 items-center gap-2">
                        <label className="font-bold">
                            {transactionType?.substring(0, 1).toUpperCase()}
                            {transactionType?.substring(1).toLowerCase()}
                        </label>
                        <div className="flex flex-col items-end justify-end gap-2 text-end">
                            <TransactionBadge status={transactionStatus} />
                        </div>
                    </div>
                    <label className="font-bold">{amount}</label>
                </div>
                <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-col items-start justify-end gap-2 text-start">
                        <label className="text-xs font-normal text-n-3">{recipientAddress}</label>
                    </div>
                    <div>
                        <label className="text-xs font-normal">
                            {transactionDetails?.date ? utils.formatDate(new Date(transactionDetails.date)) : ''}
                        </label>
                    </div>
                </div>
            </div>
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
                                transactionDetails.link && window.open(transactionDetails?.link ?? '', '_blank')
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
                            utils.copyTextToClipboardWithFallback(transactionDetails?.link ?? '')
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
                                consts.supportedPeanutChains.find((chain) => chain.name === transactionDetails?.chain)
                                    ?.chainId ?? ''

                            const explorerUrl = utils.getExplorerUrl(chainId)
                            window.open(`${explorerUrl}/tx/${transactionDetails?.txHash ?? ''}`, '_blank')
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
        </div>
    )
}
