'use client'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { SearchResults } from '@/components/SearchUsers/SearchResults'
import { useRecentUsers } from '@/hooks/useRecentUsers'
import { useUserSearch } from '@/hooks/useUserSearch'
import { useRef } from 'react'
import { Button } from '../0_Bruddle'
import Divider from '../0_Bruddle/Divider'
import { Icon } from '../Global/Icons/Icon'

interface RouterViewWrapperProps {
    title: string
    onPrev?: () => void
    linkCardTitle: string
    onLinkCardClick: () => void
    onUserSelect: (username: string) => void
}

const RouterViewWrapper = ({ title, onPrev, linkCardTitle, onLinkCardClick, onUserSelect }: RouterViewWrapperProps) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const { searchTerm, setSearchTerm, searchResults, isSearching, error, showMinCharError, showNoResults } =
        useUserSearch()
    const recentTransactions = useRecentUsers()

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={title} onPrev={onPrev} />

            <div className="space-y-2">
                <div className="flex flex-col gap-4">
                    <SearchInput
                        value={searchTerm}
                        onChange={handleSearchChange}
                        onClear={handleClearSearch}
                        inputRef={inputRef}
                    />

                    <div className="flex-1 overflow-hidden">
                        <SearchResults
                            searchTerm={searchTerm}
                            results={searchResults}
                            isSearching={isSearching}
                            showMinCharError={showMinCharError}
                            showNoResults={showNoResults}
                            onUserSelect={onUserSelect}
                            recentTransactions={recentTransactions.slice(0, 3)}
                        />

                        {error && <div className="mt-2 text-sm text-error">{error}</div>}
                    </div>
                </div>

                {!searchTerm && (
                    <>
                        <Divider text="or" textClassname="font-bold text-grey-1" dividerClassname="bg-grey-1" />

                        <div className="space-y-3">
                            <Button shadowSize="4" icon="link" iconSize={10} onClick={onLinkCardClick}>
                                {linkCardTitle}
                            </Button>
                            <div className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-grey-1">
                                <Icon name="info" size={10} /> Works even if they don't use Peanut!
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default RouterViewWrapper
