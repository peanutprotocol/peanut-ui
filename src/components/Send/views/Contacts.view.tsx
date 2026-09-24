'use client'

import { useRouter } from 'next/navigation'
import { sendUrl } from '@/utils/native-routes'
import NavHeader from '@/components/Global/NavHeader'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { useContacts } from '@/hooks/useContacts'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useRef, useState } from 'react'
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
    const [isExactUsernameMiss, setIsExactUsernameMiss] = useState(false)
    const [isUsernameSyntaxInvalid, setIsUsernameSyntaxInvalid] = useState(false)
    const [isUsernameChanging, setIsUsernameChanging] = useState(false)
    const [usernameCheckError, setUsernameCheckError] = useState('')
    const [canRetryUsernameCheck, setCanRetryUsernameCheck] = useState(false)
    const [usernameCheckRetry, setUsernameCheckRetry] = useState(0)
    const usernameCheckGeneration = useRef(0)

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
        const generation = ++usernameCheckGeneration.current
        const username = value.trim().replace(/^@/, '').toLowerCase()
        setUsernameCheckError('')
        setCanRetryUsernameCheck(false)
        setIsExactUsernameMiss(false)
        setIsUsernameSyntaxInvalid(false)
        try {
            const result = await usersApi.checkUsername(username)
            if (generation !== usernameCheckGeneration.current) return false
            if (result.status === 'found') return true
            if (result.status === 'rate-limited') {
                setUsernameCheckError(t('contacts.lookupLimitReached'))
                return false
            }
            if (result.status === 'invalid') {
                setUsernameCheckError(t('contacts.invalidUsername'))
            } else {
                setIsExactUsernameMiss(true)
                setUsernameCheckError(t('contacts.usernameNotFound'))
            }
            return false
        } catch {
            if (generation !== usernameCheckGeneration.current) return false
            setUsernameCheckError(t('contacts.lookupError'))
            setCanRetryUsernameCheck(true)
            return false
        }
    }

    const isSearching = !!normalizedSearchQuery
    const exactUsernameIsContact = contacts.some((contact) => contact.username.toLowerCase() === exactUsername)
    const showExactUsername = !!exactUsername && isExactUsernameFound && !isUsernameChanging && !exactUsernameIsContact
    // A search term may be a contact's full name rather than a username. Keep
    // username validation neutral until contact search settles, and leave it
    // neutral when relationship-scoped matches are available.
    const contactSearchCanStillSucceed = isFetchingContacts || contacts.length > 0
    const exactValidationFailed = isExactUsernameMiss || isUsernameSyntaxInvalid || !!usernameCheckError
    const validationIsNeutral = exactValidationFailed && contactSearchCanStillSucceed
    const hasDefinitiveSearchMiss = isUsernameSyntaxInvalid || (isExactUsernameMiss && !isUsernameChanging)

    return (
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav('send')} onPrev={onPrev} />

            <div className="space-y-4">
                <div className="flex flex-col gap-1">
                    <ValidatedInput
                        value={searchQuery}
                        debounceTime={750}
                        validationNonce={usernameCheckRetry}
                        validate={validateExactUsername}
                        shouldValidate={(value) => isPlausibleUsername(value.trim().replace(/^@/, '').toLowerCase())}
                        onUpdate={({ value, isValid, isChanging }) => {
                            const username = value.trim().replace(/^@/, '').toLowerCase()
                            const valueChanged = value !== searchQuery
                            setSearchQuery(value)
                            setIsExactUsernameFound(isValid)
                            setIsUsernameChanging(isChanging)
                            // The clear button reports isChanging=false. Invalidate
                            // by value instead so a late lookup cannot repopulate an
                            // error after the field has been emptied.
                            if (valueChanged) {
                                usernameCheckGeneration.current += 1
                                setIsExactUsernameMiss(false)
                                const syntaxInvalid = username.length >= 4 && !isPlausibleUsername(username)
                                setIsUsernameSyntaxInvalid(syntaxInvalid)
                                setCanRetryUsernameCheck(false)
                                setUsernameCheckError(syntaxInvalid ? t('contacts.invalidUsername') : '')
                            }
                        }}
                        placeholder={t('contacts.searchPlaceholder')}
                        aria-label={t('contacts.searchLabel')}
                        isSetupFlow
                        isInputChanging={isUsernameChanging}
                        validationIsNeutral={validationIsNeutral}
                    />
                    {usernameCheckError && !validationIsNeutral && (
                        <div className="flex items-center justify-between gap-2">
                            <FieldError>{usernameCheckError}</FieldError>
                            {canRetryUsernameCheck && (
                                <Button
                                    variant="ghost"
                                    className="h-auto w-fit p-0 text-body-xs"
                                    onClick={() => setUsernameCheckRetry((retry) => retry + 1)}
                                >
                                    {tCommon('retry')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {showExactUsername && exactUsername && (
                    <div className="space-y-2">
                        <h2 className="text-body-m-semibold">{t('contacts.exactUsername')}</h2>
                        <ListItem
                            position="solo"
                            title={t('contacts.usernameFound', { username: exactUsername })}
                            truncate
                            body={t('contacts.continueToSend')}
                            leading={<IconBubble icon="user" size="s" color="green" />}
                            chevron
                            onClick={() => handleUserSelect(exactUsername)}
                        />
                    </div>
                )}

                {isFetchingContacts ? (
                    <ContactsListSkeleton count={5} />
                ) : (
                    <>
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
                                                        ? 'solo'
                                                        : index === 0
                                                          ? 'top'
                                                          : index === contacts.length - 1
                                                            ? 'bottom'
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
                                                        size="s"
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
                                    containerClassName="w-full"
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
                        ) : isSearching && !showExactUsername && hasDefinitiveSearchMiss ? (
                            <EmptyState
                                title={t('contacts.noResultsTitle')}
                                icon="search"
                                description={t('contacts.noResultsDescription')}
                            />
                        ) : !isSearching && !showExactUsername ? (
                            <div className="flex flex-1 items-center justify-center">
                                <EmptyState
                                    containerClassName="w-full"
                                    title={t('contacts.emptyTitle')}
                                    icon="trophy"
                                    description={t('contacts.emptyDescription')}
                                    cta={
                                        <Button
                                            shadowSize="4"
                                            icon="link"
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
