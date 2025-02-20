import { ListItemView } from '@/components/Global/ListItemView'
import { HistoryEntryType, HistoryUserRole, TRequestHistory } from '@/services/services.types'
import { getChainName, printableAddress } from '@/utils'

interface PaymentHistoryProps {
    recipient: string
    history: TRequestHistory[]
}

export default function PaymentHistory({ recipient, history }: PaymentHistoryProps) {
    if (history.length === 0 || !recipient) return null

    const getTransactionType = (type: HistoryEntryType, userRole: HistoryUserRole) => {
        if (type === 'CLAIM') return 'Link Received'
        if (type === 'REQUEST' && userRole === 'SENDER') return 'Money Requested'
        if (type === 'REQUEST' && userRole === 'RECIPIENT') return 'Request paid'
        if (type === 'CASHOUT') return 'Cash Out'
        return type
    }

    return (
        <div className="space-y-3 border-b border-b-black">
            <div className="text-base font-semibold">
                Payment history to <span className="underline">{recipient}</span>
            </div>
            <div>
                {[...history]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 5)
                    .map((entry, idx) => (
                        // todo: render token icons
                        <ListItemView
                            key={entry.uuid}
                            id={`${entry.chainId}-${idx}`}
                            variant="history"
                            primaryInfo={{
                                title: `${entry.tokenSymbol}`,
                                subtitle: entry.chainId && `on ${getChainName(entry.chainId)}`,
                            }}
                            secondaryInfo={{
                                mainText: `$${Number(entry.amount).toFixed(2)}`,
                            }}
                            metadata={{
                                recipientAddress: entry.senderAccount
                                    ? `Paid By: ${entry.senderAccount.username || printableAddress(entry.senderAccount.identifier)} | Status: ${entry.status}`
                                    : `Status: ${entry.status}`,
                                subText: new Date(entry.timestamp).toLocaleDateString(),
                                disableEnsResolution: true,
                            }}
                        />
                    ))}
            </div>
        </div>
    )
}
