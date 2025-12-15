'use client'

import { useAppDispatch } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { useRouter, useSearchParams } from 'next/navigation'
import NavHeader from '@/components/Global/NavHeader'
import { ActionListCard } from '@/components/ActionListCard'
import { useContacts } from '@/hooks/useContacts'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useMemo, useState } from 'react'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { SearchInput } from '@/components/SearchInput'
import PeanutLoading from '@/components/Global/PeanutLoading'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Button } from '@/components/0_Bruddle/Button'

export default function ContactsView() {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const isSendingByLink = searchParams.get('view') === 'link' || searchParams.get('createLink') === 'true'
    const isSendingToContacts = searchParams.get('view') === 'contacts'
    const {
        contacts,
        isLoading: isFetchingContacts,
        error: isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
    } = useContacts({ limit: 50 })
    const [searchQuery, setSearchQuery] = useState('')

    // infinite scroll hook - disabled when searching (search is client-side)
    const { loaderRef } = useInfiniteScroll({
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        enabled: !searchQuery, // disable when user is searching
    })

    // client-side search filtering
    const filteredContacts = useMemo(() => {
        if (!searchQuery.trim()) return contacts

        const query = searchQuery.trim().toLowerCase()
        return contacts.filter((contact) => {
            const fullName = contact.fullName?.toLowerCase() ?? ''
            return contact.username.toLowerCase().includes(query) || fullName.includes(query)
        })
    }, [contacts, searchQuery])

    const redirectToSendByLink = () => {
        // reset send flow state when entering link creation flow
        dispatch(sendFlowActions.resetSendFlow())
        router.push(`${window.location.pathname}?view=link`)
    }

    const handlePrev = () => {
        // reset send flow state and navigate deterministically
        // when in sub-views (link or contacts), go back to base send page
        // otherwise, go to home
        dispatch(sendFlowActions.resetSendFlow())
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
        router.push(`/send/${username}`)
    }

    if (isFetchingContacts) {
        return <PeanutLoading />
    }

    // handle error state before checking for empty contacts
    if (!!isError) {
        return (
            <div className="flex min-h-[inherit] flex-col space-y-8">
                <NavHeader title="Send" onPrev={handlePrev} />
                <div className="flex flex-1 items-center justify-center">
                    <EmptyState
                        title="Failed to load contacts"
                        icon="alert"
                        description="We couldn't load your contacts. Please try again."
                        cta={
                            <Button
                                shadowSize="4"
                                onClick={() => refetch()}
                                className="mt-4"
                                icon="retry"
                                iconSize={12}
                            >
                                Retry
                            </Button>
                        }
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col space-y-8">
            <NavHeader title="Send" onPrev={handlePrev} />

            {contacts.length > 0 ? (
                <div className="space-y-4">
                    {/* search input */}
                    <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery('')}
                        placeholder="Search contacts..."
                    />

                    {/* contacts list */}
                    {filteredContacts.length > 0 ? (
                        <div className="space-y-2">
                            <h2 className="text-base font-bold">Your contacts</h2>
                            <div className="flex-1 space-y-0 overflow-y-auto">
                                {filteredContacts.map((contact, index) => {
                                    const isVerified = contact.bridgeKycStatus === 'approved'
                                    const displayName = contact.showFullName
                                        ? contact.fullName || contact.username
                                        : contact.username
                                    return (
                                        <ActionListCard
                                            position={
                                                filteredContacts.length === 1
                                                    ? 'single'
                                                    : index === 0
                                                      ? 'first'
                                                      : index === filteredContacts.length - 1
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

                            {/* infinite scroll loader - only active when not searching */}
                            {!searchQuery && (
                                <div ref={loaderRef} className="w-full py-4">
                                    {isFetchingNextPage && (
                                        <div className="w-full text-center text-sm text-gray-500">Loading more...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        // no search results
                        <EmptyState
                            title="No contacts found"
                            icon="search"
                            description={`Try searching for a different contact.`}
                        />
                    )}
                </div>
            ) : (
                // empty state - no contacts at all
                <div className="flex flex-1 items-center justify-center">
                    <EmptyState
                        title="No contacts yet"
                        icon="trophy"
                        description="Contacts appear when you send, request, or invite someone"
                        cta={
                            <Button
                                shadowSize="4"
                                icon="link"
                                iconSize={10}
                                onClick={handleLinkCtaClick}
                                className="mt-4"
                            >
                                Send via link
                            </Button>
                        }
                    />
                </div>
            )}
        </div>
    )
}
