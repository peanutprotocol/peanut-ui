'use client'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import { SearchInput } from '@/components/SearchUsers/SearchInput'
import { SearchResults } from '@/components/SearchUsers/SearchResults'
import { useUserSearch } from '@/hooks/useUserSearch'
import { useRef } from 'react'

interface RouterViewWrapperProps {
    title: string
    onPrev?: () => void
    linkCardTitle: string
    linkCardDescription: string
    onLinkCardClick: () => void
    onUserSelect: (username: string) => void
}

const RouterViewWrapper = ({
    title,
    onPrev,
    linkCardTitle,
    linkCardDescription,
    onLinkCardClick,
    onUserSelect,
}: RouterViewWrapperProps) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const { searchTerm, setSearchTerm, searchResults, isSearching, error, showMinCharError, showNoResults } =
        useUserSearch()

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value)
    }

    const handleClearSearch = () => {
        setSearchTerm('')
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={title} onPrev={onPrev} />

            <div className="space-y-6">
                <Card
                    position="single"
                    onClick={onLinkCardClick}
                    className="shadow-4 flex cursor-pointer items-center justify-between bg-primary-1 p-4"
                >
                    <div>
                        <h2 className="font-bold">{linkCardTitle}</h2>
                        <p className="text-sm">{linkCardDescription}</p>
                    </div>
                    <Icon name="chevron-up" size={32} className="rotate-90" />
                </Card>

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
                            recentTransactions={[]} // todo: to be be populated in history project
                            onUserSelect={onUserSelect}
                        />

                        {error && <div className="mt-2 text-sm text-error">{error}</div>}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RouterViewWrapper
