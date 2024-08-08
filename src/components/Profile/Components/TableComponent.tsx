'use client'
import * as utils from '@/utils'
import * as interfaces from '@/interfaces'
import Sorting from '@/components/Global/Sorting'
import Loading from '@/components/Global/Loading'
import { OptionsComponent } from './OptionsComponent'
import * as consts from '@/constants'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

export const TableComponent = ({
    data,
    selectedTab,
    currentPage,
    itemsPerPage,
}: {
    data: interfaces.IProfileTableData[]
    selectedTab: 'contacts' | 'history' | 'accounts'
    currentPage: number
    itemsPerPage: number
}) => {
    const router = useRouter()
    const handleSendToAddress = useCallback(
        (address: string) => {
            router.push(`/send?recipientAddress=${encodeURIComponent(address)}`)
        },
        [router]
    )

    return (
        <table className="table-custom hidden bg-background sm:table">
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
                            <th className="th-custom"></th>
                        </tr>
                    )
                )}
            </thead>
            <tbody>
                {data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((data) =>
                    selectedTab === 'history' ? (
                        data.dashboardItem && (
                            <tr
                                className="h-16 text-h8 font-normal"
                                key={(data.dashboardItem.link ?? data.dashboardItem.txHash ?? '') + Math.random()}
                            >
                                <td className="td-custom font-bold">{data.dashboardItem.type}</td>
                                <td className="td-custom font-bold">
                                    {utils.formatTokenAmount(Number(data.dashboardItem.amount), 4)}{' '}
                                    {data.dashboardItem.tokenSymbol}
                                </td>
                                <td className="td-custom font-bold">{data.dashboardItem.chain}</td>
                                <td className="td-custom">{utils.formatDate(new Date(data.dashboardItem.date))}</td>
                                <td className="td-custom">
                                    {utils.shortenAddressLong(data.dashboardItem.address ?? '')}
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
                                        <div className="border border-gray-1 px-2 py-1 text-center text-gray-1">
                                            <Loading />
                                        </div>
                                    ) : data.dashboardItem.status === 'claimed' ? (
                                        <div className="border border-green-3 px-2 py-1 text-center text-green-3">
                                            claimed
                                        </div>
                                    ) : data.dashboardItem.status === 'transfer' ? (
                                        <div className="border border-green-3 px-2 py-1 text-center text-green-3">
                                            sent
                                        </div>
                                    ) : (
                                        <div className="border border-gray-1 px-2 py-1 text-center text-gray-1">
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

                                                        const explorerUrl = utils.getExplorerUrl(chainId)
                                                        window.open(
                                                            `${explorerUrl}/tx/${data?.dashboardItem?.txHash ?? ''}`,
                                                            '_blank'
                                                        )
                                                    },
                                                },
                                                (data.dashboardItem?.type === 'Link Received' ||
                                                    data.dashboardItem.type === 'Link Sent') &&
                                                    data.dashboardItem?.link && {
                                                        name: 'Copy link',
                                                        action: () => {
                                                            utils.copyTextToClipboardWithFallback(
                                                                data.dashboardItem?.link ?? ''
                                                            )
                                                        },
                                                    },
                                                data.dashboardItem?.attachmentUrl && {
                                                    name: 'Download attachment',
                                                    action: () => {
                                                        window.open(data.dashboardItem?.attachmentUrl ?? '', '_blank')
                                                    },
                                                },
                                                data.dashboardItem?.type !== 'Link Received' &&
                                                    data.dashboardItem.status === 'pending' && {
                                                        name: 'Refund',
                                                        action: () => {
                                                            window.open(data.dashboardItem?.link ?? '', '_blank')
                                                        },
                                                    },
                                            ].filter(Boolean) as { name: string; action: () => void }[]
                                        }
                                    />
                                </td>
                            </tr>
                        )
                    ) : selectedTab === 'contacts' ? (
                        <tr className="h-16 text-h8 font-normal" key={data.key + Math.random()}>
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
                                        {
                                            name: 'Delete',
                                            action: () => {
                                                console.log('Delete') // TODO: implement delete
                                            },
                                        },
                                    ]}
                                />
                            </td>
                        </tr>
                    ) : (
                        selectedTab === 'accounts' && (
                            <tr className="h-16 text-h8 font-normal" key={data.key + Math.random()}>
                                <td className="td-custom font-bold">{data.primaryText}</td>
                                <td className="td-custom font-bold">{data.tertiaryText}</td>
                                <td className="td-custom text-end ">
                                    <OptionsComponent
                                        actionItems={[
                                            {
                                                name: 'Delete',
                                                action: () => {
                                                    console.log('Delete') // TODO: implement delete
                                                },
                                            },
                                        ]}
                                    />
                                </td>
                            </tr>
                        )
                    )
                )}
            </tbody>
        </table>
    )
}
