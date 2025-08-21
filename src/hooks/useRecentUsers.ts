import { useMemo } from 'react'
import { useTransactionHistory, HistoryEntry } from '@/hooks/useTransactionHistory'
import { RecentUser } from '@/services/users'

export function useRecentUsers() {
    const { data } = useTransactionHistory({ mode: 'latest', limit: 20 })
    const recentTransactions = useMemo(() => {
        if (!data) return []
        return data.entries.reduce((acc: RecentUser[], entry: HistoryEntry) => {
            let account
            if (entry.userRole === 'SENDER') {
                account = entry.recipientAccount
            } else if (entry.userRole === 'RECIPIENT') {
                account = entry.senderAccount
            }
            if (!account?.isUser) return acc
            const isDuplicate = acc.some(
                (user) =>
                    user.userId === account.userId || user.username.toLowerCase() === account.username.toLowerCase()
            )
            if (isDuplicate) return acc
            acc.push({
                userId: account.userId!,
                username: account.username!,
                fullName: account.fullName!,
                kycStatus: entry.isVerified ? 'approved' : 'not_started',
            })
            return acc
        }, [])
    }, [data])

    return recentTransactions
}
