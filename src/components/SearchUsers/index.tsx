import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { ApiUser, usersApi } from '@/services/users'
import { getInitialsFromName } from '@/utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../0_Bruddle'
import BaseInput from '../0_Bruddle/BaseInput'
import PeanutLoading from '../Global/PeanutLoading'
import AvatarWithBadge from '../Profile/AvatarWithBadge'
import { SearchResultCard } from './SearchResultCard'

interface SearchContentProps {
    searchTerm: string
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onClearSearch: () => void
    searchResults: ApiUser[]
    isSearching: boolean
    error: string
    inputRef: React.RefObject<HTMLInputElement>
    recentTransactions: ApiUser[]
    closePortal?: () => void
}

const SearchContent = ({
    searchTerm,
    onSearchChange,
    onClearSearch,
    searchResults = [],
    isSearching,
    error,
    inputRef,
    recentTransactions = [],
    closePortal,
}: SearchContentProps) => {
    const { user } = useAuth()
    const initals = useMemo(() => {
        return user?.user.full_name
            ? getInitialsFromName(user.user.full_name)
            : getInitialsFromName(user?.user.username || '')
    }, [user])

    const showMinCharError = searchTerm.length > 0 && searchTerm.length < 3
    const showNoResults = searchTerm.length >= 3 && !isSearching && searchResults?.length === 0

    return (
        <div className="flex h-full w-full flex-col">
            <div className="flex items-center justify-between">
                <div onClick={closePortal}>
                    <AvatarWithBadge
                        size="extra-small"
                        initials={initals}
                        isVerified
                        achievementsBadgeSize="extra-small"
                    />
                </div>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <Icon name="search" size={20} />
                    </div>
                    <BaseInput
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={onSearchChange}
                        placeholder="Name or username"
                        className="h-10 w-full rounded-sm border border-black pl-12 pr-10"
                    />
                    {searchTerm && (
                        <Button
                            variant="transparent"
                            onClick={onClearSearch}
                            className="absolute right-4 top-1/2 h-8 w-6 -translate-y-1/2 p-0"
                        >
                            <Icon name="cancel" size={16} />
                        </Button>
                    )}
                </div>
            </div>

            <div className="mt-4 flex-1 overflow-hidden">
                {showMinCharError && (
                    <div className="mt-2 text-center text-sm text-error">
                        Enter at least 3 characters to search users
                    </div>
                )}

                {searchTerm && searchResults.length > 0 && (
                    <div className="flex h-full flex-col">
                        <h2 className="mb-2 text-base font-bold">People</h2>
                        <div className="flex-1 overflow-y-auto">
                            {searchResults.map((user, index) => (
                                <SearchResultCard
                                    key={user.userId}
                                    username={user.username}
                                    fullName={user.fullName}
                                    position={
                                        searchResults.length === 1
                                            ? 'single'
                                            : index === 0
                                              ? 'first'
                                              : index === searchResults.length - 1
                                                ? 'last'
                                                : 'middle'
                                    }
                                />
                            ))}
                        </div>
                    </div>
                )}

                {isSearching && (
                    <div className="flex h-full items-center justify-center">
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
                                        username={user.username}
                                        fullName={user.fullName}
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
                            <Card position="single" className="p-0">
                                <div className="flex flex-col items-center justify-center gap-2 py-6">
                                    <div className="rounded-full bg-primary-1 p-2">
                                        <Icon name="txn-off" size={16} />
                                    </div>
                                    <div className="text-center">
                                        <div className="font-medium">No transactions yet!</div>
                                        <div className="text-sm text-grey-1">Start by sending or requesting money</div>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </>
                )}

                {error && <div className="text-red-500 mt-2 text-sm">{error}</div>}
            </div>
        </div>
    )
}

export const SearchUsers = () => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedValue, setDebouncedValue] = useState(searchTerm)
    const [searchResults, setSearchResults] = useState<ApiUser[]>([])
    // todo: to be implemented in history project
    const [recentTransactions, setRecentTransactions] = useState<ApiUser[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState('')
    const currentValueRef = useRef(searchTerm)
    const inputRef = useRef<HTMLInputElement>(null)

    // Handle debounced search
    useEffect(() => {
        currentValueRef.current = searchTerm
        const handler = setTimeout(() => {
            setDebouncedValue(searchTerm)
        }, 300)

        return () => {
            clearTimeout(handler)
        }
    }, [searchTerm])

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            // Small delay to ensure the portal is mounted
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }, [isExpanded])

    // Handle API call when debounced value changes
    useEffect(() => {
        if (!debouncedValue) {
            setSearchResults([])
            return
        }

        const performSearch = async () => {
            try {
                setIsSearching(true)
                setError('')
                const response = await usersApi.search(debouncedValue)
                if (currentValueRef.current === debouncedValue) {
                    setSearchResults(response.users)
                }
            } catch (err) {
                if (err instanceof Error && err.message.includes('3 characters')) {
                    setSearchResults([])
                } else {
                    setError('Failed to search users')
                }
            } finally {
                setIsSearching(false)
            }
        }

        performSearch()
    }, [debouncedValue])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchTerm(value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
        setSearchResults([])
    }

    return (
        <>
            <Button
                variant="transparent"
                onClick={() => setIsExpanded(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full p-0 hover:bg-gray-100"
            >
                <Icon name="search" size={20} />
            </Button>

            {isExpanded &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex h-full flex-col bg-background p-5">
                        <SearchContent
                            searchTerm={searchTerm}
                            onSearchChange={handleSearchChange}
                            onClearSearch={handleClearSearch}
                            searchResults={searchResults}
                            isSearching={isSearching}
                            error={error}
                            inputRef={inputRef}
                            recentTransactions={recentTransactions}
                            closePortal={() => {
                                setIsExpanded(false)
                                setSearchTerm('')
                                setSearchResults([])
                            }}
                        />
                    </div>,
                    document.body
                )}
        </>
    )
}
