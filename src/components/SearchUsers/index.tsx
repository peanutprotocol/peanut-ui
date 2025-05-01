import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useUserSearch } from '@/hooks/useUserSearch'
import { ApiUser } from '@/services/users'
import { getInitialsFromName } from '@/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../0_Bruddle'
import { SearchInput } from './SearchInput'
import { SearchResults } from './SearchResults'

interface SearchContentProps {
    closePortal: () => void
    recentTransactions: ApiUser[]
}

const SearchContent = ({ closePortal, recentTransactions }: SearchContentProps) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const { user } = useAuth()
    const { searchTerm, setSearchTerm, searchResults, isSearching, error, showMinCharError, showNoResults } =
        useUserSearch()

    const initials = useMemo(() => {
        return user?.user.full_name
            ? getInitialsFromName(user.user.full_name)
            : getInitialsFromName(user?.user.username || '')
    }, [user?.user.full_name, user?.user.username])

    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value
            // prevent state updates if the only change is adding/removing spaces
            if (value.trim() === searchTerm.trim()) return
            setSearchTerm(value)
        },
        [searchTerm, setSearchTerm]
    )

    const handleClearSearch = useCallback(() => {
        setSearchTerm('')
    }, [setSearchTerm])

    return (
        <div className="flex h-full w-full flex-col gap-4">
            <div className="flex items-center justify-between">
                <Button onClick={closePortal} variant="stroke" className="h-7 w-7 p-0">
                    <Icon name="chevron-up" size={32} className="h-8 w-8 -rotate-90" />
                </Button>

                <SearchInput
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onClear={handleClearSearch}
                    inputRef={inputRef}
                    className="ml-4 flex-1"
                />
            </div>

            <div className="flex-1 overflow-hidden">
                <SearchResults
                    searchTerm={searchTerm}
                    results={searchResults}
                    isSearching={isSearching}
                    showMinCharError={showMinCharError}
                    showNoResults={showNoResults}
                    recentTransactions={recentTransactions}
                />

                {error && <div className="mt-2 text-sm text-error">{error}</div>}
            </div>
        </div>
    )
}

export const SearchUsers = () => {
    const [isExpanded, setIsExpanded] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    // todo: to be implemented in hisotry project
    const [recentTransactions, setRecentTransactions] = useState<ApiUser[]>([])

    // focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            // small delay to ensure the portal is mounted
            setTimeout(() => {
                inputRef.current?.focus()
            }, 100)
        }
    }, [isExpanded])

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
                            closePortal={() => {
                                setIsExpanded(false)
                            }}
                            recentTransactions={recentTransactions}
                        />
                    </div>,
                    document.body
                )}
        </>
    )
}
