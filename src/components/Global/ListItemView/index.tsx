'use client'
import Modal from '@/components/Global/Modal'
import { supportedPeanutChains } from '@/constants'
import { IDashboardItem } from '@/interfaces'
import { copyTextToClipboardWithFallback, getExplorerUrl } from '@/utils'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import CopyToClipboard from '../CopyToClipboard'
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
    variant: 'history' | 'balance' | 'req_history'
    primaryInfo: {
        title: React.ReactNode
        subtitle?: React.ReactNode
    }
    secondaryInfo: {
        mainText: string
        subText?: string
    }
    metadata: {
        tokenLogo?: string
        chainLogo?: string
    }
    details?: IDashboardItem | TokenBalance
}

export const ListItemView = ({ id, variant, primaryInfo, secondaryInfo, metadata, details }: ListItemViewProps) => {
    const [modalVisible, setModalVisible] = useState(false)
    const isHistory = variant === 'history'
    const transactionDetails = isHistory ? (details as IDashboardItem) : null

    return (
        <div
            className={twMerge(
                'flex w-full flex-row items-center justify-between gap-2 border border-t-0 border-n-1 bg-white p-3 text-h8 font-normal dark:bg-black',
                isHistory ? 'cursor-pointer' : ''
            )}
            key={id}
            onClick={() => isHistory && setModalVisible(true)}
        >
            <div className="relative mr-2 min-w-fit">
                {!!metadata.tokenLogo ? (
                    <Image
                        src={metadata.tokenLogo}
                        alt="token logo"
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full"
                    />
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

            <div className="flex w-full items-start justify-between gap-2">
                <div className={twMerge('flex flex-col gap-2 md:flex-col')}>
                    {primaryInfo.title &&
                        (typeof primaryInfo.subtitle === 'string' ? (
                            <label className="font-bold">{primaryInfo.title}</label>
                        ) : (
                            (primaryInfo.title as React.ReactNode)
                        ))}

                    {primaryInfo.subtitle &&
                        (typeof primaryInfo.subtitle === 'string' ? (
                            <label className="text-xs text-n-3">{primaryInfo.subtitle}</label>
                        ) : (
                            primaryInfo.subtitle
                        ))}
                </div>

                <div className="flex flex-col items-end justify-between gap-2">
                    <label className="font-bold">{secondaryInfo.mainText}</label>
                    {secondaryInfo.subText && <label className="text-xs text-n-3">{secondaryInfo.subText}</label>}
                </div>
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
                            className="flex h-12 w-full cursor-pointer items-center justify-between gap-2 px-4 text-h8 font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            <label className="block">Copy link </label>
                            <CopyToClipboard
                                fill="black"
                                textToCopy={transactionDetails?.link as string}
                                className="h-5 w-5"
                            />
                        </div>
                    )}
                    {(transactionDetails?.type === 'Link Received' ||
                        transactionDetails?.type === 'Link Sent' ||
                        transactionDetails?.type === 'Request Link') && (
                        <Link
                            className="flex h-12 w-full cursor-pointer items-center justify-between gap-2 px-4 text-h8 font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                            href={transactionDetails.link!}
                        >
                            <label className="block">See status</label>
                            <Icon name="arrow-up-right" className="h-5 w-5" />
                        </Link>
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
                            className="flex h-12 w-full cursor-pointer items-center justify-between gap-2 px-4 text-h8 font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            <label className="block">Show in explorer </label>
                            <Icon name="arrow-up-right" className="h-5 w-5" />
                        </div>
                    )}
                    {transactionDetails?.attachmentUrl && (
                        <div
                            onClick={() => {
                                window.open(transactionDetails.attachmentUrl, '_blank', 'noopener,noreferrer')
                            }}
                            className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                        >
                            Download attachment
                        </div>
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
