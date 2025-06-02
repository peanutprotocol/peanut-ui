import { ApiUser } from '@/services/users'
import { twMerge } from 'tailwind-merge'
import Card from '../Global/Card'
import EmptyState from '../Global/EmptyStates/EmptyState'
import { Icon } from '../Global/Icons/Icon'
import PeanutLoading from '../Global/PeanutLoading'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import { SearchResultCard } from './SearchResultCard'

interface SearchResultsProps {
    searchTerm: string
    results: ApiUser[]
    isSearching: boolean
    showMinCharError: boolean
    showNoResults: boolean
    className?: string
    recentTransactions?: Pick<ApiUser, 'userId' | 'username' | 'fullName'>[]
    onUserSelect: (username: string) => void
}

export const SearchResults = ({
    searchTerm,
    results,
    isSearching,
    showMinCharError,
    showNoResults,
    className,
    recentTransactions = [],
    onUserSelect,
}: SearchResultsProps) => {
    return (
        <div className={twMerge('flex h-full flex-col overflow-hidden', className)}>
            {showMinCharError && (
                <div className="mt-4 text-center text-sm text-error">Enter at least 3 characters to search users</div>
            )}

            {searchTerm && results.length > 0 && (
                <>
                    <h2 className="mb-2 text-base font-bold">People</h2>
                    <div className="flex-1 overflow-y-auto">
                        {results.map((user, index) => (
                            <SearchResultCard
                                position={
                                    results.length === 1
                                        ? 'single'
                                        : index === 0
                                          ? 'first'
                                          : index === results.length - 1
                                            ? 'last'
                                            : 'middle'
                                }
                                key={user.userId}
                                title={user.fullName || user.username}
                                description={`@${user.username}`}
                                leftIcon={<AvatarWithBadge size="extra-small" name={user.fullName || user.username} />}
                                onClick={() => onUserSelect(user.username)}
                            />
                        ))}
                    </div>
                </>
            )}

            {isSearching && (
                <div className="flex flex-1 items-center justify-center">
                    <PeanutLoading />
                </div>
            )}

            {showNoResults && (
                <Card position="single" className="mt-8 p-0">
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                        <div className="rounded-full bg-primary-1 p-2">
                            <Icon name="user" size={16} />
                        </div>
                        <div className="text-center">
                            <div className="font-medium">No users found</div>
                            <div className="text-sm text-grey-1">Try searching with a different term</div>
                        </div>
                    </div>
                </Card>
            )}

            {!searchTerm && (
                <>
                    <h2 className="mb-2 text-base font-bold">Recent transactions</h2>
                    {recentTransactions.length > 0 ? (
                        <div className="flex-1 overflow-y-auto">
                            {recentTransactions.map((user, index) => (
                                <SearchResultCard
                                    key={user.userId}
                                    title={user.fullName || user.username}
                                    description={`@${user.username}`}
                                    leftIcon={
                                        <AvatarWithBadge size="extra-small" name={user.fullName || user.username} />
                                    }
                                    onClick={() => onUserSelect(user.username)}
                                    position={
                                        recentTransactions.length === 1
                                            ? 'single'
                                            : index === 0
                                              ? 'first'
                                              : index === recentTransactions.length - 1
                                                ? 'last'
                                                : 'middle'
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No transactions yet!"
                            description="Start by sending or requesting money"
                            icon="txn-off"
                        />
                    )}
                </>
            )}
        </div>
    )
}
