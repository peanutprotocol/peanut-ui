'use client'

import { useRouter } from 'next/navigation'
import { sendUrl } from '@/utils/native-routes'
import NavHeader from '@/components/Global/NavHeader'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { useContacts } from '@/hooks/useContacts'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useState } from 'react'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { SearchInput } from '@/components/SearchInput'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Button } from '@/components/0_Bruddle/Button'
import { useDebounce } from '@/hooks/useDebounce'
import { ContactsListSkeleton } from '@/components/Common/ContactsListSkeleton'
import { useTranslations } from 'next-intl'
import { useUserByUsername } from '@/hooks/useUserByUsername'
import { isPlausibleUsername } from '@/constants/routes'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'

export default function ContactsView({ onPrev }: { onPrev: () => void }) {
    const t = useTranslations('send')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')

    // debounce search query to avoid excessive API calls
    const debouncedSearchQuery = useDebounce(searchQuery, 300)
    const normalizedSearchQuery = debouncedSearchQuery.trim().replace(/^@/, '').toLowerCase()
    const exactUsername = isPlausibleUsername(normalizedSearchQuery) ? normalizedSearchQuery : null

    // Contacts search is intentionally relationship-scoped. Resolve a valid,
    // exact username separately so someone can pay any Peanut user, including a
    // person they have never interacted with before.
    const { user: exactUser, isLoading: isLookingUpExactUser } = useUserByUsername(exactUsername)

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
        search: normalizedSearchQuery || undefined,
    })

    // infinite scroll hook - always enabled for server-side pagination
    const { loaderRef } = useInfiniteScroll({
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        enabled: true,
    })

    const redirectToSendByLink = () => {
        router.push(`${window.location.pathname}?view=link`)
    }

    const handleLinkCtaClick = () => {
        redirectToSendByLink()
    }

    // handle user selection from contacts
    const handleUserSelect = (username: string) => {
        router.push(sendUrl(username))
    }

    const isSearching = !!normalizedSearchQuery
    const exactUserMatchesQuery = exactUser?.username.toLowerCase() === normalizedSearchQuery
    const exactUserIsContact = contacts.some((contact) => contact.userId === exactUser?.userId)
    const showExactUser = exactUserMatchesQuery && !exactUserIsContact
    const showSearchLoading = isFetchingContacts || (exactUsername !== null && isLookingUpExactUser)

    return (
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav('send')} onPrev={onPrev} />

            <div className="space-y-4">
                {/* This field is also the global exact-username entry point, so it
                    stays available even before the user has any contacts. */}
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onClear={() => setSearchQuery('')}
                    placeholder={t('contacts.searchPlaceholder')}
                    aria-label={t('contacts.searchLabel')}
                />

                {showSearchLoading ? (
                    <ContactsListSkeleton count={5} />
                ) : (
                    <>
                        {showExactUser && exactUser && (
                            <div className="space-y-2">
                                <h2 className="text-body-m-semibold">{t('contacts.exactUsername')}</h2>
                                <ListItem
                                    position="single"
                                    title={
                                        <VerifiedUserLabel
                                            name={
                                                exactUser.showFullName
                                                    ? exactUser.fullName || exactUser.username
                                                    : exactUser.username
                                            }
                                            username={exactUser.username}
                                            isVerified={exactUser.isVerified}
                                        />
                                    }
                                    body={`@${exactUser.username}`}
                                    leading={<IconBubble icon="user" size="s" color="green" />}
                                    chevron
                                    onClick={() => handleUserSelect(exactUser.username)}
                                />
                            </div>
                        )}

                        {contacts.length > 0 ? (
                            <div className="space-y-2">
                                <h2 className="text-body-m-semibold">{t('contacts.yourContacts')}</h2>
                                <div className="space-y-0 flex-1 overflow-y-auto">
                                    {contacts.map((contact, index) => {
                                        const isVerified = contact.isVerified
                                        const displayName = contact.showFullName
                                            ? contact.fullName || contact.username
                                            : contact.username
                                        return (
                                            <ListItem
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
                                                body={`@${contact.username}`}
                                                leading={
                                                    <UserAvatar
                                                        size="extra-small"
                                                        name={contact.username}
                                                        avatarKey={contact.avatarKey}
                                                        decorative
                                                    />
                                                }
                                                chevron
                                                onClick={() => handleUserSelect(contact.username)}
                                            />
                                        )
                                    })}
                                </div>

                                {/* infinite scroll loader */}
                                <div ref={loaderRef} className="w-full py-4">
                                    {isFetchingNextPage && (
                                        <div className="w-full text-center text-body-s">
                                            {t('contacts.loadingMore')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : isError && !showExactUser ? (
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
                        ) : isSearching && !showExactUser ? (
                            <EmptyState
                                title={t('contacts.noResultsTitle')}
                                icon="search"
                                description={t('contacts.noResultsDescription')}
                            />
                        ) : !showExactUser ? (
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
                        ) : null}
                    </>
                )}
            </div>
        </div>
    )
}
