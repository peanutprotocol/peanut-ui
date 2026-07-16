'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { sendUrl } from '@/utils/native-routes'
import NavHeader from '@/components/Global/NavHeader'
import { ActionListCard } from '@/components/ActionListCard'
import { useContacts } from '@/hooks/useContacts'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useState, useEffect } from 'react'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { SearchInput } from '@/components/SearchInput'
import PeanutLoading from '@/components/Global/PeanutLoading'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Button } from '@/components/0_Bruddle/Button'
import { useDebounce } from '@/hooks/useDebounce'
import { ContactsListSkeleton } from '@/components/Common/ContactsListSkeleton'
import { useTranslations } from 'next-intl'

export default function ContactsView() {
    const t = useTranslations('send')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const searchParams = useSearchParams()
    const isSendingByLink = searchParams.get('view') === 'link' || searchParams.get('createLink') === 'true'
    const isSendingToContacts = searchParams.get('view') === 'contacts'
    const [searchQuery, setSearchQuery] = useState('')
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

    // debounce search query to avoid excessive API calls
    const debouncedSearchQuery = useDebounce(searchQuery, 300)

    // fetch contacts with server-side search
    const {
        contacts,
        isLoading: isFetchingContacts,
        error: isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
    } = useContacts({
        limit: 50,
        search: debouncedSearchQuery || undefined,
    })

    // infinite scroll hook - always enabled for server-side pagination
    const { loaderRef } = useInfiniteScroll({
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        enabled: true,
    })

    // track when we've loaded data at least once
    useEffect(() => {
        if (!hasLoadedOnce && !isFetchingContacts) {
            setHasLoadedOnce(true)
        }
    }, [isFetchingContacts, hasLoadedOnce])

    const redirectToSendByLink = () => {
        router.push(`${window.location.pathname}?view=link`)
    }

    const handlePrev = () => {
        // when in sub-views (link or contacts), go back to base send page
        // otherwise, go to home
        if (isSendingByLink || isSendingToContacts) {
            router.push('/send')
        } else {
            router.push('/home')
        }
    }

    const handleLinkCtaClick = () => {
        redirectToSendByLink()
    }

    // handle user selection from contacts
    const handleUserSelect = (username: string) => {
        router.push(sendUrl(username))
    }

    // only show full loading on initial load (before any data has been fetched)
    if (isFetchingContacts && !hasLoadedOnce) {
        return <PeanutLoading />
    }

    // handle error state before checking for empty contacts
    if (!!isError) {
        return (
            <div className="flex min-h-[inherit] flex-col space-y-8">
                <NavHeader title={tNav('send')} onPrev={handlePrev} />
                <div className="flex flex-1 items-center justify-center">
                    <EmptyState
                        title={t('contacts.errorTitle')}
                        icon="alert"
                        description={t('contacts.errorDescription')}
                        cta={
                            <Button
                                shadowSize="4"
                                onClick={() => refetch()}
                                className="mt-4"
                                icon="retry"
                                iconSize={12}
                            >
                                {tCommon('retry')}
                            </Button>
                        }
                    />
                </div>
            </div>
        )
    }

    // determine if we have any contacts (initial load without search)
    const hasContacts = contacts.length > 0 || !!debouncedSearchQuery
    const isSearching = !!debouncedSearchQuery
    const hasNoSearchResults = isSearching && contacts.length === 0

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <NavHeader title={tNav('send')} onPrev={handlePrev} />

            {hasContacts ? (
                <div className="space-y-4">
                    {/* search input - always show when there are contacts or when searching */}
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery('')}
                        placeholder={t('contacts.searchPlaceholder')}
                    />

                    {/* contacts list or search results */}
                    {isFetchingContacts ? (
                        // show skeleton when searching/refetching
                        <ContactsListSkeleton count={5} />
                    ) : contacts.length > 0 ? (
                        <div className="space-y-2">
                            <h2 className="text-base font-bold">{t('contacts.yourContacts')}</h2>
                            <div className="flex-1 space-y-0 overflow-y-auto">
                                {contacts.map((contact, index) => {
                                    const isVerified = contact.isVerified
                                    const displayName = contact.showFullName
                                        ? contact.fullName || contact.username
                                        : contact.username
                                    return (
                                        <ActionListCard
                                            position={
                                                contacts.length === 1
                                                    ? 'single'
                                                    : index === 0
                                                      ? 'first'
                                                      : index === contacts.length - 1
                                                        ? 'last'
                                                        : 'middle'
                                            }
                                            key={contact.userId}
                                            title={
                                                <VerifiedUserLabel
                                                    name={displayName}
                                                    username={contact.username}
                                                    isVerified={isVerified}
                                                    haveSentMoneyToUser={contact.relationshipTypes.includes(
                                                        'sent_money'
                                                    )}
                                                />
                                            }
                                            description={`@${contact.username}`}
                                            leftIcon={<AvatarWithBadge size="extra-small" name={displayName} />}
                                            onClick={() => handleUserSelect(contact.username)}
                                        />
                                    )
                                })}
                            </div>

                            {/* infinite scroll loader */}
                            <div ref={loaderRef} className="w-full py-4">
                                {isFetchingNextPage && (
                                    <div className="w-full text-center text-sm text-gray-500">
                                        {t('contacts.loadingMore')}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : hasNoSearchResults ? (
                        // no search results - keep search input visible
                        <EmptyState
                            title={t('contacts.noResultsTitle')}
                            icon="search"
                            description={t('contacts.noResultsDescription')}
                        />
                    ) : null}
                </div>
            ) : (
                // empty state - no contacts at all (initial load with no contacts)
                <div className="flex flex-1 items-center justify-center">
                    <EmptyState
                        title={t('contacts.emptyTitle')}
                        icon="trophy"
                        description={t('contacts.emptyDescription')}
                        cta={
                            <Button
                                shadowSize="4"
                                icon="link"
                                iconSize={10}
                                onClick={handleLinkCtaClick}
                                className="mt-4"
                            >
                                {t('linkCard.cta')}
                            </Button>
                        }
                    />
                </div>
            )}
        </div>
    )
}
