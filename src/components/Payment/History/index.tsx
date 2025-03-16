import AddressLink from '@/components/Global/AddressLink'
import { ListItemView } from '@/components/Global/ListItemView'
import { RecipientType } from '@/lib/url-parser/types/payment'
import { TRequestHistory } from '@/services/services.types'
import { formatAmount, getChainName, getTokenLogo } from '@/utils'

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
                            variant="req_history"
                            primaryInfo={{
                                title: (
                                    <div>
                                        <label className="font-bold">{entry.tokenSymbol}</label>
                                        {entry.chainId && (
                                            <label className="text-xs text-n-3">
                                                {' '}
                                                on {getChainName(entry.chainId)}
                                            </label>
                                        )}
                                    </div>
                                ),
                                subtitle: (
                                    <div className="text-xs text-n-3">
                                        {entry.senderAccount ? (
                                            <div>
                                                Paid by:{' '}
                                                <AddressLink
                                                    address={
                                                        entry.senderAccount.username || entry.senderAccount.identifier
                                                    }
                                                />{' '}
                                                <br className="md:hidden" /> <span className="hidden md:inline">|</span>{' '}
                                                Status: {entry.status}
                                            </div>
                                        ) : (
                                            `Status: ${entry.status}`
                                        )}
                                    </div>
                                ),
                            }}
                            secondaryInfo={{
                                mainText: `$${formatAmount(entry.amount)}`,
                                subText: new Date(entry.timestamp).toLocaleDateString(),
                            }}
                            metadata={{
                                tokenLogo: getTokenLogo(entry.tokenSymbol),
                            }}
                        />
                    ))}
            </div>
        </div>
    )
}
