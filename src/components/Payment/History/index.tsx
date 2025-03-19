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
        <div className="space-y-3">
            <div className="text-base font-semibold">
                Payment history to <AddressLink address={recipient.identifier} />
            </div>
            <div className="border-t border-t-black">
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
                                recipientAddress: entry.senderAccount
                                    ? entry.senderAccount.username || entry.senderAccount.identifier
                                    : '',
                                recipientAddressFormatter: (address) =>
                                    entry.senderAccount ? (
                                        <>
                                            Paid By: <AddressLink address={address} /> | Status: {entry.status}
                                        </>
                                    ) : (
                                        <>Status: {entry.status}</>
                                    ),
                                subText: new Date(entry.timestamp).toLocaleDateString(),
                                tokenLogo: getTokenLogo(entry.tokenSymbol),
                            }}
                        />
                    ))}
            </div>
        </div>
    )
}
