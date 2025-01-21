'use client'
import { ARBITRUM_ICON } from '@/assets'
import Modal from '@/components/Global/Modal'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * MobileTableComponent renders a mobile-friendly table for user profile data, such as accounts, contacts, or transaction history.
 * It handles different types of items (e.g., history, contacts, accounts), provides UI for avatars, statuses, and actions.
 * The component also includes a modal for additional actions like copying links, refunding, or viewing transactions in explorers.
 */
export const MobileTableComponent = ({
    itemKey,
    primaryText,
    secondaryText,
    tertiaryText,
    quaternaryText,
    type,
    avatar,
    dashboardItem,
    address,
}: interfaces.IProfileTableData) => {
    const [modalVisible, setModalVisible] = useState(false)

    return (
        <div
            className={twMerge(
                'flex w-full flex-row items-center justify-between gap-2 border border-b-0 border-n-1 bg-white p-3 text-h8 font-normal dark:bg-black'
            )}
            key={itemKey}
            onClick={() => {
                if (type !== 'accounts') setModalVisible(true)
            }}
        >
            <div className="relative mr-2 min-w-fit">
                {dashboardItem?.tokenSymbol === 'USDC' && (
                    <Image
                        src={'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040'}
                        alt="token logo"
                        width={30}
                        height={30}
                        className="rounded-full"
                    />
                )}

                {dashboardItem?.tokenSymbol === 'USDC' && dashboardItem.chain === 'Arbitrum One' && (
                    <Image
                        src={ARBITRUM_ICON}
                        alt="token logo"
                        width={16}
                        height={16}
                        className="absolute -right-2 bottom-0 size-4 rounded-full"
                    />
                )}
            </div>

            <div className="flex w-full flex-col gap-2" key={itemKey}>
                <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex w-full max-w-48 items-center gap-2">
                        <label className="font-bold">
                            {primaryText?.substring(0, 1).toUpperCase()}
                            {primaryText?.substring(1).toLowerCase()}
                        </label>
                        <div className="flex flex-col items-end justify-end gap-2 text-end">
                            <div className="text-xs">
                                {type === 'history' && dashboardItem ? (
                                    dashboardItem.status === 'claimed' ? (
                                        <div className="border border-teal-3 p-0.5 text-center text-teal-3">
                                            claimed
                                        </div>
                                    ) : dashboardItem.status === 'transfer' ? (
                                        <div className="border border-teal-3 p-0.5 text-center text-teal-3">sent</div>
                                    ) : dashboardItem.status === 'paid' ? (
                                        <div className="border border-teal-3 p-0.5 text-center text-teal-3">paid</div>
                                    ) : dashboardItem.status ? (
                                        <div className="border border-grey-1 p-0.5 text-center text-grey-1">
                                            {dashboardItem.status.toLowerCase().replaceAll('_', ' ')}
                                        </div>
                                    ) : (
                                        <div className="border border-grey-1 p-0.5 text-center text-grey-1">
                                            pending
                                        </div>
                                    )
                                ) : type === 'contacts' ? (
                                    <label className="font-bold">txs: {quaternaryText}</label>
                                ) : (
                                    type === 'accounts' && ''
                                )}
                            </div>
                        </div>
                    </div>
                    <label>{secondaryText}</label>
                </div>
                <div className="flex w-full flex-row items-center justify-between">
                    <div className="flex flex-col items-start justify-end gap-2 text-start">
                        <label className="text-xs font-normal">{tertiaryText}</label>
                    </div>
                    <div>
                        <label className="text-xs font-normal">
                            {dashboardItem?.date ? utils.formatDate(new Date(dashboardItem.date)) : ''}
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
                <div className="flex w-full flex-col items-center justify-center p-2 "></div>
                {type === 'history' ? (
                    <>
                        {dashboardItem?.type !== 'Link Received' &&
                            dashboardItem?.type !== 'Request Link' &&
                            dashboardItem?.status === 'pending' && (
                                <div
                                    onClick={() => {
                                        dashboardItem.link && window.open(dashboardItem?.link ?? '', '_blank')
                                    }}
                                    className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20 "
                                >
                                    Refund
                                </div>
                            )}
                        {(dashboardItem?.type === 'Link Received' ||
                            dashboardItem?.type === 'Link Sent' ||
                            dashboardItem?.type === 'Request Link') && (
                            <div
                                onClick={() => {
                                    utils.copyTextToClipboardWithFallback(dashboardItem?.link ?? '')
                                }}
                                className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                            >
                                Copy link
                            </div>
                        )}
                        {dashboardItem?.txHash && (
                            <div
                                onClick={() => {
                                    const chainId =
                                        consts.supportedPeanutChains.find(
                                            (chain) => chain.name === dashboardItem?.chain
                                        )?.chainId ?? ''

                                    const explorerUrl = utils.getExplorerUrl(chainId)
                                    window.open(`${explorerUrl}/tx/${dashboardItem?.txHash ?? ''}`, '_blank')
                                }}
                                className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20 "
                            >
                                Show in explorer
                            </div>
                        )}
                        {dashboardItem?.attachmentUrl && (
                            <a
                                href={dashboardItem.attachmentUrl}
                                download
                                target="_blank"
                                className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                            >
                                Download attachment
                            </a>
                        )}
                        {dashboardItem?.type === 'Offramp Claim' && dashboardItem.status !== 'claimed' && (
                            <a
                                href={(() => {
                                    const url = new URL(dashboardItem?.link ?? '')
                                    url.pathname = '/cashout/status'
                                    return url.toString()
                                })()}
                                target="_blank"
                                className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20"
                            >
                                Check Status
                            </a>
                        )}
                    </>
                ) : (
                    type === 'contacts' && (
                        <Link href={`/send?recipientAddress=${encodeURIComponent(address as string)}`}>
                            <div className="flex h-12 w-full items-center gap-2 px-4 text-h8 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 disabled:cursor-not-allowed disabled:bg-n-4 disabled:hover:bg-n-4/90 dark:hover:bg-white/20 ">
                                Send to this address
                            </div>
                        </Link>
                    )
                )}
            </Modal>
        </div>
    )
}
