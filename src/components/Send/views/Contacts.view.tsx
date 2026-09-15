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
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { Button } from '@/components/0_Bruddle/Button'
import { useDebounce } from '@/hooks/useDebounce'
import { ContactsListSkeleton } from '@/components/Common/ContactsListSkeleton'
import { useTranslations } from 'next-intl'
import { isPlausibleUsername } from '@/constants/routes'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { usersApi } from '@/services/users'

export default function ContactsView({ onPrev }: { onPrev: () => void }) {
    const t = useTranslations('send')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')
    const [isExactUsernameFound, setIsExactUsernameFound] = useState(false)
    const [isUsernameChanging, setIsUsernameChanging] = useState(false)
    const [usernameCheckError, setUsernameCheckError] = useState('')

    // Relationship-scoped contact filtering can be faster than the protected
    // global check, which ValidatedInput debounces separately below.
    const debouncedSearchQuery = useDebounce(searchQuery, 300)
    const normalizedSearchQuery = debouncedSearchQuery.trim().replace(/^@/, '').toLowerCase()
    const normalizedInput = searchQuery.trim().replace(/^@/, '').toLowerCase()
    const exactUsername = isPlausibleUsername(normalizedInput) ? normalizedInput : null

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

    const validateExactUsername = async (value: string): Promise<boolean> => {
        const username = value.trim().replace(/^@/, '').toLowerCase()
        setUsernameCheckError('')
        try {
            const result = await usersApi.checkUsername(username)
            if (result.status === 'found') return true
            if (result.status === 'rate-limited') {
                setUsernameCheckError(t('contacts.lookupLimitReached'))
                return false
            }
            setUsernameCheckError(
                result.status === 'invalid' ? t('contacts.invalidUsername') : t('contacts.usernameNotFound')
            )
            return false
        } catch {
            setUsernameCheckError(t('contacts.lookupError'))
            return false
        }
    }

    const isSearching = !!normalizedSearchQuery
    const exactUsernameIsContact = contacts.some((contact) => contact.username.toLowerCase() === exactUsername)
    const showExactUsername = !!exactUsername && isExactUsernameFound && !isUsernameChanging && !exactUsernameIsContact

    return (
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav('send')} onPrev={onPrev} />

            <div className="space-y-4">
                <div className="flex flex-col gap-1">
                    <ValidatedInput
                        value={searchQuery}
                        debounceTime={750}
                        validate={validateExactUsername}
                        shouldValidate={(value) => isPlausibleUsername(value.trim().replace(/^@/, '').toLowerCase())}
                        onUpdate={({ value, isValid, isChanging }) => {
                            const username = value.trim().replace(/^@/, '').toLowerCase()
                            setSearchQuery(value)
                            setIsExactUsernameFound(isValid)
                            setIsUsernameChanging(isChanging)
                            if (isChanging) {
                                setUsernameCheckError(
                                    username.length >= 4 && !isPlausibleUsername(username)
                                        ? t('contacts.invalidUsername')
                                        : ''
                                )
                            }
                        }}
                        placeholder={t('contacts.searchPlaceholder')}
                        aria-label={t('contacts.searchLabel')}
                        isSetupFlow
                        isInputChanging={isUsernameChanging}
                    />
                    {usernameCheckError && <FieldError>{usernameCheckError}</FieldError>}
                </div>

                {isFetchingContacts ? (
                    <ContactsListSkeleton count={5} />
                ) : (
                    <>
                        {showExactUsername && exactUsername && (
                            <div className="space-y-2">
                                <h2 className="text-body-m-semibold">{t('contacts.exactUsername')}</h2>
                                <ListItem
                                    position="single"
                                    title={t('contacts.usernameFound', { username: exactUsername })}
                                    body={t('contacts.continueToSend')}
                                    leading={<IconBubble icon="user" size="s" color="green" />}
                                    chevron
                                    onClick={() => handleUserSelect(exactUsername)}
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
                        ) : isError && !showExactUsername ? (
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
                        ) : isSearching && !showExactUsername && !isUsernameChanging ? (
                            <EmptyState
                                title={t('contacts.noResultsTitle')}
                                icon="search"
                                description={t('contacts.noResultsDescription')}
                            />
                        ) : !showExactUsername ? (
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
