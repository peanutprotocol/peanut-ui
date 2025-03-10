import AddressLink from '@/components/Global/AddressLink'
import { ListItemView } from '@/components/Global/ListItemView'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { TRequestHistory } from '@/services/services.types'
import { getChainName, printableAddress, getTokenLogo } from '@/utils'

interface PaymentHistoryProps {
    recipient: { identifier: string; recipientType: RecipientType; resolvedAddress: string }
    history: TRequestHistory[]
}

export default function PaymentHistory({ recipient, history }: PaymentHistoryProps) {
    if (history.length === 0 || !recipient) return null

    return (
        <div className="space-y-3 border-b border-b-black">
            <div className="text-base font-semibold">
                Payment history to <AddressLink address={recipient.resolvedAddress} />
            </div>
            <div>
                {[...history]
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 5)
                    .map((entry, idx) => (
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
                                tokenLogo: getTokenLogo(entry.tokenSymbol),
                            }}
                        />
                    ))}
            </div>
        </div>
    )
}
