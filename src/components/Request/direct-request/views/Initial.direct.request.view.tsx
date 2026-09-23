'use client'
import { Button } from '@/components/0_Bruddle/Button'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import FileUploadInput from '@/components/Global/FileUploadInput'
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
import { useSafeBack } from '@/hooks/useSafeBack'

interface DirectRequestInitialViewProps {
    username: string
}

const DirectRequestInitialView = ({ username }: DirectRequestInitialViewProps) => {
    const t = useTranslations('request')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const onBack = useSafeBack('/home')
    const { user: authUser, isFetchingUser, userFetchError } = useAuth()
    const router = useRouter()
    const contact = useRequestContact(username)
    const needsSetup = !!authUser && !authUser.accounts.some((account) => account.type === AccountType.PEANUT_WALLET)

    useEffect(() => {
        if (isFetchingUser || authUser === undefined || userFetchError) return
        if (!authUser || needsSetup) {
            saveRedirectUrl()
            router.replace(authUser ? '/setup/finish' : '/setup')
        }
    }, [authUser, isFetchingUser, userFetchError, needsSetup, router])
    const { spendableBalance: balance, formattedSpendableBalance, address } = useWallet()
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

    // Displayed total spendable, single-sourced + formatted by the hook; empty
    // while loading so we don't flash "$0.00".
    const peanutWalletBalance = useMemo(() => {
        return balance === undefined ? '' : formattedSpendableBalance
    }, [balance, formattedSpendableBalance])

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
            authUser === undefined ||
            (!userFetchError && (!authUser || needsSetup)) ||
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
                buttonText: authUser?.user.userId ? t('validation.goToHome') : t('validation.createWallet'),
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
    ])

    if (
        isRecipientUserLoading ||
        isFetchingUser ||
        authUser === undefined ||
        (!userFetchError && (!authUser || needsSetup)) ||
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
                    <ValidationErrorView {...validationError} />
                </div>
            </div>
        )
    }

    if (userFetchError || contact.isError || !contact.data) {
        return (
            <div className="flex min-h-inherit flex-col gap-8">
                <NavHeader onPrev={onBack} title={tNav('request')} />
                <PageStack.Center className="gap-4">
                    <Notification priority="error">
                        {t(
                            userFetchError || contact.isError
                                ? 'errors.contactsUnavailable'
                                : 'errors.moneyContactsOnly'
                        )}
                    </Notification>
                    {contact.isError && (
                        <Button onClick={() => contact.refetch()} icon="retry">
                            {tCommon('retry')}
                        </Button>
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
                        redirectTo="/request"
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
                    isVerified={recipientUser?.isVerified ?? false}
                    haveSentMoneyToUser={contact.data.relationshipTypes.includes('sent_money')}
                />

                <div className="space-y-4">
                    <AmountInput
                        className="w-full"
                        initialAmount={currentInputValue}
                        setPrimaryAmount={handleTokenValueChange}
                        onSubmit={() => setView('confirm')}
                        walletBalance={peanutWalletBalance}
                        hideCurrencyToggle
                    />

                    <FileUploadInput
                        placeholder={tCommon('comment')}
                        attachmentOptions={attachmentOptions}
                        setAttachmentOptions={setAttachmentOptions}
                        className="h-11"
                    />
                    {errorState.showError ? (
                        <Button
                            variant="purple"
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

                    {errorState.errorMessage && <Notification priority="error">{errorState.errorMessage}</Notification>}
                </div>
            </PageStack.Center>
        </div>
    )
}

export default DirectRequestInitialView
