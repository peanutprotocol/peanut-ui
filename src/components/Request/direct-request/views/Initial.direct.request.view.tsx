'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Callout } from '@/components/0_Bruddle/Callout'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
import AmountInput from '@/components/Global/AmountInput'
import ValidationErrorView, { type ValidationErrorViewProps } from '@/components/Payment/Views/Error.validation.view'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import UserCard from '@/components/User/UserCard'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAuth } from '@/context/authContext'
import { type IAttachmentOptions } from '@/interfaces/attachment'
import { usersApi } from '@/services/users'
import { formatAmount, saveRedirectUrl } from '@/utils/general.utils'
import { captureException } from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { loadingStateKey } from '@/i18n/app/loading-states'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRequestContact } from '@/hooks/useRequestContact'
import { useRouter } from 'next/navigation'
import { AccountType } from '@/interfaces/interfaces'
import { apiErrorStatus } from '@/services/api-error'
import { useUserByUsername } from '@/hooks/useUserByUsername'
import { useRequestBack } from '@/components/Request/useRequestBack'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'
import { profileUrl, sendUrl } from '@/utils/native-routes'

interface DirectRequestInitialViewProps {
    username: string
}

const DirectRequestInitialView = ({ username }: DirectRequestInitialViewProps) => {
    const t = useTranslations('request')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const onBack = useRequestBack()
    const tMigration = useTranslations('migration')
    const tHome = useTranslations('home.drawers')
    // a guest on a broken request link is asked to join — during the migration
    // that means the app, not web signup
    const { interceptGuestCta, storeHandoffModal, handoffActive } = useGuestStoreHandoff()
    const { user: authUser, isFetchingUser, userFetchError, fetchUser } = useAuth()
    const authUnavailable = !authUser && !!userFetchError
    const router = useRouter()
    const contact = useRequestContact(username)
    const needsSetup = !!authUser && !authUser.accounts.some((account) => account.type === AccountType.PEANUT_WALLET)
    // a settled signed-out visitor gets a card, not a redirect; undefined means auth is still loading
    const isGuest = authUser === null && !userFetchError

    useEffect(() => {
        if (isFetchingUser || userFetchError || !needsSetup) return
        saveRedirectUrl()
        router.replace('/setup/finish')
    }, [isFetchingUser, userFetchError, needsSetup, router])
    const { address } = useWallet()
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: undefined,
        fileUrl: undefined,
        rawFile: undefined,
    })
    const [currentInputValue, setCurrentInputValue] = useState<string>('')
    const [view, setView] = useState<'initial' | 'confirm' | 'success'>('initial')
    const { setLoadingState, loadingState } = useContext(loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [validationError, setValidationError] = useState<ValidationErrorViewProps | null>(null)

    const {
        user: recipientUser,
        isLoading: isRecipientUserLoading,
        error: recipientUserError,
    } = useUserByUsername(username)

    const resetRequestState = () => {
        setView('initial')
        setCurrentInputValue('')
        setAttachmentOptions({
            message: undefined,
            fileUrl: undefined,
            rawFile: undefined,
        })
    }

    const handleTokenValueChange = (value: string | undefined) => {
        setCurrentInputValue(value || '')
    }

    const isButtonDisabled = useMemo(() => {
        const parsedAmount = parseFloat(currentInputValue)
        const isAmountInvalid = isNaN(parsedAmount) || parsedAmount <= 0
        return (
            !recipientUser?.username ||
            recipientUser.username.toLowerCase() !== username?.toLowerCase() ||
            isAmountInvalid ||
            !authUser?.user.userId ||
            !address ||
            !contact.data ||
            contact.isError
        )
    }, [
        recipientUser?.username,
        username,
        currentInputValue,
        address,
        authUser?.user.userId,
        contact.data,
        contact.isError,
    ])

    const isButtonLoading = useContext(loadingStateContext).isLoading

    const createRequestCharge = useCallback(async () => {
        if (isButtonDisabled) {
            return
        }
        setLoadingState('Requesting')
        setErrorState({ showError: false, errorMessage: '' })
        try {
            const toAddress = address
            if (!toAddress) {
                throw new Error('No recipient address available')
            }

            await usersApi.requestByUsername({
                username: recipientUser!.username,
                amount: currentInputValue,
                toAddress,
                attachment: attachmentOptions,
            })
            setLoadingState('Idle')
            setView('success')
        } catch (error) {
            const status = apiErrorStatus(error)
            let errorMessage = t('errors.createRequestFailed')
            if (status === 401) errorMessage = t('errors.signInRequired')
            if (status === 429) errorMessage = t('errors.requestLimit')
            if (status === 403 && error instanceof Error) {
                if (error.message === 'Request sender does not own recipient address')
                    errorMessage = t('errors.walletOwnership')
                if (error.message === 'You can only request money from people you have paid or been paid by') {
                    errorMessage = t('errors.moneyContactsOnly')
                }
            }
            if (status !== 401 && status !== 403 && status !== 429) captureException(error)
            setErrorState({
                showError: true,
                errorMessage,
            })
            setLoadingState('Idle')
        }
    }, [
        isButtonDisabled,
        recipientUser?.username,
        currentInputValue,
        address,
        attachmentOptions,
        setLoadingState,
        setErrorState,
        t,
    ])

    useEffect(() => {
        if (
            isRecipientUserLoading ||
            isFetchingUser ||
            (authUser === undefined && !userFetchError) ||
            (!userFetchError && needsSetup) ||
            contact.isLoading
        ) {
            return
        }

        const getValidationErrorObject = (
            kind: 'invalid' | 'missing',
            specificMessage?: string
        ): ValidationErrorViewProps => {
            const message =
                specificMessage ??
                (kind === 'invalid' ? t('validation.invalidRecipientMessage') : t('validation.missingRecipientMessage'))
            return {
                title:
                    kind === 'invalid' ? t('validation.invalidRecipientTitle') : t('validation.missingRecipientTitle'),
                message,
                buttonText: authUser?.user.userId
                    ? t('validation.goToHome')
                    : handoffActive
                      ? tMigration('downloadPeanut')
                      : t('validation.createWallet'),
                redirectTo: authUser?.user.userId ? '/home' : '/setup',
            }
        }

        if (!username) {
            setValidationError(getValidationErrorObject('missing'))
            return
        }

        if (recipientUserError || !recipientUser) {
            setValidationError(getValidationErrorObject('invalid'))
            return
        }

        setValidationError(null)
    }, [
        username,
        authUser,
        recipientUser,
        recipientUserError,
        isRecipientUserLoading,
        isFetchingUser,
        userFetchError,
        needsSetup,
        contact.isLoading,
        t,
        tMigration,
        handoffActive,
    ])

    if (
        isRecipientUserLoading ||
        isFetchingUser ||
        (authUser === undefined && !userFetchError) ||
        (!userFetchError && needsSetup) ||
        contact.isLoading
    ) {
        return (
            <div className="flex min-h-inherit w-full items-center justify-center">
                <Loading variant="mascot" />
            </div>
        )
    }

    if (validationError) {
        return (
            <div className="flex flex-col items-center justify-center gap-8">
                {!!authUser?.user.userId ? <NavHeader onPrev={onBack} title={tNav('request')} /> : null}
                <div className="my-auto space-y-4 flex h-full w-full flex-col items-center justify-center md:w-6/12">
                    <ValidationErrorView
                        {...validationError}
                        onButtonClick={!authUser?.user.userId ? () => interceptGuestCta() : undefined}
                    />
                    {storeHandoffModal}
                </div>
            </div>
        )
    }

    // guests have no header on the public layout, so no NavHeader here
    if (isGuest) {
        const onJoin = () => {
            if (interceptGuestCta()) return
            saveRedirectUrl()
            router.push('/setup')
        }
        return (
            <PageStack.Center>
                <EmptyState
                    icon="user"
                    title={t('blocked.guestTitle', { username })}
                    description={t(handoffActive ? 'blocked.guestDescriptionApp' : 'blocked.guestDescription', {
                        username,
                    })}
                    cta={
                        <div className="mt-4 flex w-full flex-col gap-3">
                            <Button variant="primary" className="w-full" onClick={onJoin}>
                                {handoffActive ? tMigration('downloadPeanut') : t('validation.createWallet')}
                            </Button>
                            <Button variant="secondary" className="w-full" href={profileUrl(username)}>
                                {t('blocked.viewProfile')}
                            </Button>
                        </div>
                    }
                />
                {storeHandoffModal}
            </PageStack.Center>
        )
    }

    if (authUnavailable || contact.isError || !contact.data) {
        const lookupFailed = authUnavailable || contact.isError
        return (
            <div className="flex min-h-inherit flex-col gap-8">
                <NavHeader onPrev={onBack} title={tNav('request')} />
                <PageStack.Center>
                    {lookupFailed ? (
                        <EmptyState
                            icon="error"
                            iconColor="red"
                            title={tCommon('somethingWentWrong')}
                            description={t('errors.contactsUnavailable')}
                            cta={
                                <div className="mt-4 flex w-full flex-col gap-3">
                                    <Button
                                        className="w-full"
                                        onClick={() => (authUnavailable ? fetchUser() : contact.refetch())}
                                        icon="retry"
                                    >
                                        {tCommon('retry')}
                                    </Button>
                                </div>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon="txn-off"
                            title={t('blocked.title', { username })}
                            description={t('errors.moneyContactsOnly')}
                            cta={
                                <div className="mt-4 flex w-full flex-col gap-3">
                                    <Button
                                        variant="primary"
                                        className="w-full"
                                        icon="arrow-up-right"
                                        href={sendUrl(username)}
                                    >
                                        {t('blocked.sendCta', { username })}
                                    </Button>
                                    <Button variant="secondary" className="w-full" icon="link" href="/request">
                                        {tHome('shareRequestLink')}
                                    </Button>
                                </div>
                            }
                        />
                    )}
                </PageStack.Center>
            </div>
        )
    }

    if (view === 'success') {
        if (!recipientUser) return null
        return (
            <div className="flex min-h-inherit flex-col justify-between gap-8">
                {!!authUser?.user.userId ? (
                    <NavHeader onPrev={() => resetRequestState()} title={tNav('request')} />
                ) : (
                    <div className="text-center text-heading-xs md:hidden">{tNav('request')}</div>
                )}

                <PageStack.Center className="gap-4">
                    <PaymentSuccessView
                        user={recipientUser}
                        amount={formatAmount(currentInputValue)}
                        message={attachmentOptions.message}
                        type="REQUEST"
                    />
                </PageStack.Center>
            </div>
        )
    }

    return (
        <div className="flex min-h-inherit flex-col justify-between gap-8">
            {!!authUser?.user.userId ? (
                <NavHeader onPrev={onBack} title={tNav('request')} />
            ) : (
                <div className="text-center text-heading-xs md:hidden">{tNav('request')}</div>
            )}

            <PageStack.Center className="gap-4">
                <UserCard
                    type="request"
                    recipientType={'USERNAME'}
                    username={recipientUser?.username || username}
                    fullName={recipientUser?.fullName}
                    avatarKey={recipientUser?.avatarKey}
                    isVerified={recipientUser?.isVerified ?? false}
                    haveSentMoneyToUser={contact.data.relationshipTypes.includes('sent_money')}
                />

                <div className="space-y-4">
                    <AmountInput
                        className="w-full"
                        initialAmount={currentInputValue}
                        setPrimaryAmount={handleTokenValueChange}
                        onSubmit={() => setView('confirm')}
                        hideCurrencyToggle
                    />

                    <BaseInput
                        placeholder={tCommon('comment')}
                        value={attachmentOptions.message}
                        maxLength={140}
                        onChange={(event) =>
                            setAttachmentOptions({ ...attachmentOptions, message: event.target.value })
                        }
                    />
                    {errorState.showError ? (
                        <Button
                            variant="primary"
                            shadowSize="4"
                            onClick={() => {
                                setErrorState({ showError: false, errorMessage: '' })
                            }}
                            loading={isButtonLoading}
                            className="w-full"
                            icon="retry"
                        >
                            {tCommon('reset')}
                        </Button>
                    ) : (
                        <Button
                            shadowSize="4"
                            onClick={createRequestCharge}
                            disabled={isButtonDisabled || isButtonLoading}
                            loading={isButtonLoading}
                            icon="arrow-down-left"
                            iconSize={12}
                        >
                            {isButtonLoading ? tLoading(loadingStateKey(loadingState)) : tNav('request')}
                        </Button>
                    )}

                    {errorState.errorMessage && <Callout priority="error">{errorState.errorMessage}</Callout>}
                </div>
            </PageStack.Center>
        </div>
    )
}

export default DirectRequestInitialView
