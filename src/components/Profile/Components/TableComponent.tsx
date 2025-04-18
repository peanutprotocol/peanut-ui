'use client'
import AddressLink from '@/components/Global/AddressLink'
import Loading from '@/components/Global/Loading'
import Sorting from '@/components/Global/Sorting'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'
import { copyTextToClipboardWithFallback, formatDate, formatTokenAmount, getExplorerUrl } from '@/utils'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { OptionsComponent } from './OptionsComponent'

/**
 * TableComponent renders a responsive table for displaying profile-related data based on the selected tab (e.g., history, contacts, or accounts).
 * It handles sorting, pagination, and action buttons for each row, such as viewing transaction details or sending tokens.
 * The component also integrates specific actions using the OptionsComponent, which provides a dropdown for additional functionality like showing transactions in an explorer, copying links, or downloading attachments.
 */
export const TableComponent = ({
    data,
    selectedTab,
    currentPage,
    itemsPerPage,
    handleDeleteLink,
}: {
    data: interfaces.IProfileTableData[]
    selectedTab: 'contacts' | 'history' | 'accounts' | undefined
    currentPage: number
    itemsPerPage?: number
    handleDeleteLink: (link: string) => void
}) => {
    const router = useRouter()
    const handleSendToAddress = useCallback(
        (address: string) => {
            router.push(`/send?recipientAddress=${encodeURIComponent(address)}`)
        },
        [router]
    )

    return (
        <table className="table-custom hidden sm:table">
            <thead>
                {selectedTab === 'history' ? (
                    <tr>
                        <th className="th-custom">
                            <Sorting title="Type" />
                        </th>
                        <th className="th-custom">
                            <Sorting title="Amount" />
                        </th>
                        <th className="th-custom">
                            <Sorting title="Chain" />
                        </th>
                        <th className="th-custom">
                            <Sorting title="Date" />
                        </th>
                        <th className="th-custom ">
                            <Sorting title="From" />
                        </th>
                        <th className="th-custom ">
                            <Sorting title="Ref." />
                        </th>
                        <th className="th-custom ">
                            <Sorting title="Status" />
                        </th>
                        <th className="th-custom"></th>
                    </tr>
                ) : selectedTab === 'contacts' ? (
                    <tr>
                        <th className="th-custom"></th>
                        <th className="th-custom">
                            <Sorting title="Username" />
                        </th>
                        <th className="th-custom">
                            <Sorting title="Address" />
                        </th>
                        <th className="th-custom">
                            <Sorting title="Number of transactions" />
                        </th>
                        <th className="th-custom"></th>
                    </tr>
                ) : (
                    selectedTab === 'accounts' && (
                        <tr>
                            <th className="th-custom">
                                <Sorting title="Type" />
                            </th>
                            <th className="th-custom">
                                <Sorting title="Identifier" />
                            </th>
                            {/* <th className="th-custom"></th> */}
                        </tr>
                    )
                )}
            </thead>
            <tbody>
                {data
                    .slice((currentPage - 1) * (itemsPerPage as number), currentPage * (itemsPerPage as number))
                    .map((data) =>
                        selectedTab === 'history' ? (
                            data.dashboardItem && (
                                <tr key={(data.dashboardItem.link ?? data.dashboardItem.txHash ?? '') + Math.random()}>
                                    <td className="td-custom font-bold">{data.dashboardItem.type}</td>
                                    <td className="td-custom font-bold">
                                        {formatTokenAmount(Number(data.dashboardItem.amount), 4)}{' '}
                                        {data.dashboardItem.tokenSymbol}
                                    </td>
                                    <td className="td-custom font-bold">{data.dashboardItem.chain}</td>
                                    <td className="td-custom">{formatDate(new Date(data.dashboardItem.date))}</td>
                                    <td className="td-custom">
                                        <AddressLink address={data.dashboardItem.address ?? ''} />
                                    </td>
                                    <td className="td-custom max-w-32">
                                        <span
                                            className="block flex-grow overflow-hidden text-ellipsis whitespace-nowrap"
                                            title={data.dashboardItem.message ? data.dashboardItem.message : ''}
                                        >
                                            {data.dashboardItem.message ? data.dashboardItem.message : ''}
                                        </span>
                                    </td>

                                    <td className="td-custom">
                                        {!data.dashboardItem.status ? (
                                            <div className="border border-grey-1 px-2 py-1 text-center text-grey-1">
                                                <Loading />
                                            </div>
                                        ) : data.dashboardItem.status === 'claimed' ? (
                                            <div className="border border-teal-3 px-2 py-1 text-center text-teal-3">
                                                claimed
                                            </div>
                                        ) : data.dashboardItem.status === 'transfer' ? (
                                            <div className="border border-teal-3 px-2 py-1 text-center text-teal-3">
                                                sent
                                            </div>
                                        ) : data.dashboardItem.status === 'paid' ? (
                                            <div className="border border-teal-3 px-2 py-1 text-center text-teal-3">
                                                paid
                                            </div>
                                        ) : data.dashboardItem.status ? (
                                            <div className="border border-grey-1 px-2 py-1 text-center text-grey-1">
                                                {data.dashboardItem.status.toLowerCase().replaceAll('_', ' ')}
                                            </div>
                                        ) : (
                                            <div className="border border-grey-1 px-2 py-1 text-center text-grey-1">
                                                pending
                                            </div>
                                        )}
                                    </td>
                                    <td className="td-custom text-end ">
                                        <OptionsComponent
                                            actionItems={
                                                [
                                                    data.dashboardItem?.txHash && {
                                                        name: 'Show in explorer',
                                                        action: () => {
                                                            const chainId =
                                                                consts.supportedPeanutChains.find(
                                                                    (chain) => chain.name === data.dashboardItem?.chain
                                                                )?.chainId ?? ''

                                                            const explorerUrl = getExplorerUrl(chainId)
                                                            window.open(
                                                                `${explorerUrl}/tx/${data?.dashboardItem?.txHash ?? ''}`,
                                                                '_blank'
                                                            )
                                                        },
                                                    },
                                                    (data.dashboardItem?.type === 'Link Received' ||
                                                        data.dashboardItem.type === 'Link Sent' ||
                                                        data.dashboardItem.type === 'Request Link') &&
                                                        data.dashboardItem?.link && {
                                                            name: 'Copy link',
                                                            action: () => {
                                                                copyTextToClipboardWithFallback(
                                                                    data.dashboardItem?.link ?? ''
                                                                )
                                                            },
                                                        },
                                                    data.dashboardItem?.attachmentUrl && {
                                                        name: 'Download attachment',
                                                        action: () => {
                                                            window.open(
                                                                data.dashboardItem?.attachmentUrl ?? '',
                                                                '_blank'
                                                            )
                                                        },
                                                    },
                                                    data.dashboardItem?.type !== 'Link Received' &&
                                                        data.dashboardItem?.type !== 'Request Link' &&
                                                        data.dashboardItem.status === 'pending' && {
                                                            name: 'Refund',
                                                            action: () => {
                                                                window.open(data.dashboardItem?.link ?? '', '_blank')
                                                            },
                                                        },
                                                    data.dashboardItem?.type === 'Offramp Claim' &&
                                                        data.dashboardItem.status !== 'claimed' && {
                                                            name: 'Check status',
                                                            action: () => {
                                                                const url = new URL(data.dashboardItem?.link ?? '')
                                                                url.pathname = '/cashout/status'

                                                                window.open(url.toString(), '_blank')
                                                            },
                                                        },
                                                    data.dashboardItem.type === 'Request Link' &&
                                                        data.dashboardItem?.link &&
                                                        data.dashboardItem.status === 'pending' && {
                                                            name: 'Delete',
                                                            action: () => {
                                                                handleDeleteLink(data.dashboardItem?.link as string)
                                                            },
                                                        },
                                                ].filter(Boolean) as { name: string; action: () => void }[]
                                            }
                                        />
                                    </td>
                                </tr>
                            )
                        ) : selectedTab === 'contacts' ? (
                            <tr className="h-16 text-h8 font-normal" key={data.itemKey + Math.random()}>
                                <td className="td-custom w-[12px] font-bold">
                                    <div className="order w-max border-black border-n-1 p-2">
                                        <img alt="" loading="eager" src={data.avatar.avatarUrl} className="h-8 w-8" />
                                    </div>
                                </td>
                                <td className="td-custom font-bold">{data.primaryText}</td>
                                <td className="td-custom font-bold">{data.tertiaryText}</td>
                                <td className="td-custom font-bold">{data.quaternaryText}</td>
                                <td className="td-custom text-end ">
                                    <OptionsComponent
                                        actionItems={[
                                            {
                                                name: 'Send to this address',
                                                action: () => {
                                                    const recipientAddress = data.address as string
                                                    handleSendToAddress(recipientAddress)
                                                },
                                            },
                                        ]}
                                    />
                                </td>
                            </tr>
                        ) : (
                            selectedTab === 'accounts' && (
                                <tr className="h-16 text-h8 font-normal" key={data.itemKey + Math.random()}>
                                    <td className="td-custom font-bold">{data.primaryText}</td>
                                    <td className="td-custom font-bold">{data.tertiaryText}</td>
                                </tr>
                            )
                        )
                    )}
            </tbody>
        </table>
    )
}
