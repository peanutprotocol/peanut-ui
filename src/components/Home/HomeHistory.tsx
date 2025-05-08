'use client'

import AddressLink from '@/components/Global/AddressLink'
import Icon from '@/components/Global/Icon'
import { ListItemView } from '@/components/Global/ListItemView'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { TransactionBadge } from '@/components/Global/TransactionBadge'
import { formatDate, getChainLogo, getTokenLogo, getChainName } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'

const HomeHistory = () => {
    const { data: historyData, isLoading, isError, error } = useTransactionHistory({ mode: 'latest', limit: 3 })

    if (isLoading) {
        return <PeanutLoading />
    }

    if (isError) {
        console.error(error)
        Sentry.captureException(error)
        return <div className="w-full py-4 text-center">Error loading history: {error?.message}</div>
    }

    if (!historyData?.entries.length) {
        return (
            <div className="mx-auto mt-6 w-full space-y-2 md:max-w-2xl md:space-y-3">
                <h2 className="text-baes font-bold">Recent Transactions</h2>
                <div className="h-full w-full border-t border-n-1 py-8 text-center">
                    <p className="text-sm text-gray-500">No transactions yet</p>
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto w-full space-y-3 pb-28 md:max-w-2xl md:space-y-3">
            <Link href="/history" className="flex items-center justify-between">
                <h2 className="text-base font-bold">Transactions</h2>
                <Icon width={30} height={30} name="arrow-next" />
            </Link>
            <div className="h-full w-full border-t border-n-1">
                {!!historyData?.entries.length &&
                    historyData!.entries.map((item) => (
                        <div key={item.uuid}>
                            <ListItemView
                                id={item.uuid}
                                variant="history"
                                primaryInfo={{
                                    title: (
                                        <div className="flex flex-col items-start gap-2 md:flex-row md:items-center ">
                                            <div className="font-bold">
                                                {item.type} {item.userRole}
                                            </div>
                                            <div className="flex flex-col items-end justify-end gap-2 text-end">
                                                <TransactionBadge status={item.status as string} />
                                            </div>
                                        </div>
                                    ),
                                    subtitle: !!item.recipientAccount.identifier && (
                                        <div className="text-xs text-gray-1" onClick={(e) => e.stopPropagation()}>
                                            To: <AddressLink address={item.recipientAccount.identifier} />
                                        </div>
                                    ),
                                }}
                                secondaryInfo={{
                                    mainText: item.extraData?.usdAmount,
                                    subText: item.timestamp ? formatDate(new Date(item.timestamp)) : '',
                                }}
                                metadata={{
                                    tokenLogo: getTokenLogo(item.tokenSymbol),
                                    chainLogo: getChainLogo(getChainName(item.chainId) ?? ''),
                                }}
                                details={item}
                            />
                        </div>
                    ))}
            </div>
        </div>
    )
}

export default HomeHistory
