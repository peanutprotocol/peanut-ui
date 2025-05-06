import React from 'react'
import TransactionCard from './TransactionCard'
import { TransactionDetails } from '../TransactionDetails/TransactionDetailsDrawer'

interface MockHistoryEntriesProps {
    transactions: TransactionDetails[]
}

const MockHistoryEntries: React.FC<MockHistoryEntriesProps> = ({ transactions }) => {
    return (
        <div className="mt-6 space-y-3">
            <h2 className="font-bold">Recent Activity (Mock)</h2>
            <div className="space-y-0">
                {transactions.map((tx, index) => (
                    <TransactionCard
                        key={tx.id}
                        type={
                            tx.direction === 'send' || tx.direction === 'request_received'
                                ? 'send'
                                : tx.direction === 'request_sent'
                                  ? 'request'
                                  : tx.direction === 'withdraw'
                                    ? 'withdraw'
                                    : 'add'
                        }
                        name={tx.userName}
                        amount={Number(tx.amount)}
                        status={tx.status}
                        initials={tx.initials}
                        transaction={tx}
                        position={index === 0 ? 'first' : index === transactions.length - 1 ? 'last' : 'middle'}
                    />
                ))}
            </div>
        </div>
    )
}

export default MockHistoryEntries
