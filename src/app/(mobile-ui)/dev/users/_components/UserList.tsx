'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
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
            <ol>
                {users.map((user, index) => (
                    <li key={user.user_id}>
                        <ListItem
                            title={displayName(user)}
                            truncate
                            position={getCardPosition(index, users.length)}
                            onClick={() => onSelect(user.user_id)}
                            trailing={<KycBadge status={user.kyc_status} />}
                            // the list sits inside a bordered card: drop the row's own side borders and radius
                            className={twMerge(
                                'rounded-none border-x-0 px-4 py-3 first:border-t-0 hover:bg-background-badge-accent/30',
                                user.user_id === selectedId && 'bg-background-selection'
                            )}
                            body={
                                <span className="flex min-w-0 flex-col gap-0.5 text-body-xs">
                                    <span className="flex min-w-0 gap-3">
                                        {user.username && <span className="shrink-0">@{user.username}</span>}
                                        {user.email && <span className="truncate">{user.email}</span>}
                                    </span>
                                    <span className="flex gap-3">
                                        <span>{listDate(user, sort)}</span>
                                        {user.residence_country && (
                                            <span className="font-mono">{user.residence_country}</span>
                                        )}
                                        {user.is_active === false && <span>Inactive</span>}
                                    </span>
                                </span>
                            }
                        />
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
