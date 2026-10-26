'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { twMerge } from '@/utils/tw'
import { fetchUserList } from '../userRecords.api'
import type { UserSort } from '../userRecords.types'
import { displayName, listDate } from '../userRecords.utils'
import KycBadge from './KycBadge'

export default function UserList({
    query,
    sort,
    selectedId,
    onSelect,
}: {
    query: string
    sort: UserSort
    selectedId: string | null
    onSelect: (userId: string) => void
}) {
    const list = useInfiniteQuery({
        queryKey: ['dev-user-records', 'list', query, sort],
        queryFn: ({ pageParam }) => fetchUserList({ query, sort, before: pageParam }),
        initialPageParam: null as string | null,
        getNextPageParam: (page) => page.next,
        retry: false,
    })

    if (list.isError) return <Callout priority="error">{list.error.message}</Callout>
    if (list.isPending) return <p className="px-4 py-3 text-body-s text-foreground-secondary">Loading users…</p>

    const users = list.data.pages.flatMap((page) => page.users)
    if (users.length === 0) return <p className="px-4 py-3 text-body-s text-foreground-secondary">No users match.</p>

    return (
        <div className="flex flex-col">
            <ol className="divide-y divide-border-default">
                {users.map((user) => (
                    <li key={user.user_id}>
                        <button
                            type="button"
                            onClick={() => onSelect(user.user_id)}
                            aria-current={user.user_id === selectedId ? 'true' : undefined}
                            className={twMerge(
                                'flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-background-badge-accent/30',
                                user.user_id === selectedId && 'bg-background-selection'
                            )}
                        >
                            <span className="flex w-full items-center justify-between gap-2">
                                <span className="truncate text-body-s-semibold">{displayName(user)}</span>
                                <KycBadge status={user.kyc_status} />
                            </span>
                            <span className="flex min-w-0 gap-3 text-body-xs text-foreground-secondary">
                                {user.username && <span className="shrink-0">@{user.username}</span>}
                                {user.email && <span className="truncate">{user.email}</span>}
                            </span>
                            <span className="flex gap-3 text-body-xs text-foreground-secondary">
                                <span>{listDate(user, sort)}</span>
                                {user.residence_country && <span className="font-mono">{user.residence_country}</span>}
                                {user.is_active === false && <span>Inactive</span>}
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
            {list.hasNextPage && (
                <div className="p-4">
                    <Button variant="secondary" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
                        Load more
                    </Button>
                </div>
            )}
        </div>
    )
}
