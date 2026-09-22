'use client'
import { fetchTokenDetails } from '@/app/actions/tokens'
import { useToast } from '@/components/0_Bruddle/Toast'
import { toSupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'
import { HARNESS_ENABLED } from '@/constants/harness.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { loadingStateContext } from '@/context/loadingStates.context'
import { useAuth } from '@/context/authContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { firstPayableCorridor } from '@/features/deposit-accounts/rails'
import { canShare } from '@/features/deposit-accounts/resolveScreen'
import { type IToken } from '@/interfaces/interfaces'
import { type IAttachmentOptions } from '@/interfaces/attachment'
import { wireErrorCode, apiErrorStatus } from '@/services/api-error'
import { requestsApi } from '@/services/requests'
import { beginClipboardCopy } from '@/utils/clipboard.utils'
import { fetchTokenSymbol, formatTokenAmount, getRequestLink, isNativeCurrency } from '@/utils/general.utils'
import * as Sentry from '@sentry/nextjs'
import * as peanutInterfaces from '@/interfaces/peanut-sdk-types'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryStates } from 'nuqs'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { payLinkUrl, shareableUrl } from '@/utils/url.utils'
import { requestAmountFromInput, toApiAmount, usdEquivalent, type AmountInputSides } from '../requestCurrency'

/**
 * State and behaviour for the create-request-link screen: amount/attachment
 * state, request create/update against the API, the debounced attachment
 * autosave, and the QR/share link derivation. The view only renders.
 */
export const useCreateRequestLink = () => {
    const t = useTranslations('request')
    const toast = useToast()
    const { address, isConnected } = useWallet()
    const { user } = useAuth()
    const { selectedChainID, setSelectedChainID, selectedTokenAddress, setSelectedTokenAddress, selectedTokenData } =
        useContext(tokenSelectorContext)
    const { setLoadingState } = useContext(loadingStateContext)
    const queryClient = useQueryClient()
    // url params — nuqs per the url-as-state rule. `amount` and `merchant` are
    // read once (the split-bill deep link); `currency` is the requester's live
    // choice, so a reload or a shared link keeps it. No `currency` means USD,
    // which is what every link made before the field existed means.
    const [{ amount: paramsAmount, merchant, currency: paramsCurrency }, setQuery] = useQueryStates({
        amount: parseAsString,
        merchant: parseAsString,
        currency: parseAsString,
    })
    const currency = toSupportedExchangeCurrency(paramsCurrency) ?? 'USD'
    // Sanitize amount and limit to 2 decimal places
    const sanitizedAmount = useMemo(() => {
        if (!paramsAmount || isNaN(parseFloat(paramsAmount))) return ''
        return formatTokenAmount(paramsAmount, 2) ?? ''
    }, [paramsAmount])
    const merchantComment = merchant ? t('billSplitFor', { merchant }) : null

    // Core state
    // What the requester typed, in `currency`.
    const [requestAmount, setRequestAmount] = useState<string>(sanitizedAmount)
    // `exchangeRate` is units of `currency` per dollar.
    const { exchangeRate: liveRate } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: currency,
        enabled: currency !== 'USD',
    })
    // The last good rate for this currency outlives a failed refetch. The
    // amount field builds its two sides from the rate once; if the dollar side
    // vanished while the requester was typing in it, the field read a side that
    // no longer existed and threw on the next keystroke. The API prices the
    // request itself, so a rate a few minutes old only ages the estimate.
    const lastRate = useRef<{ currency: string; rate: number }>({ currency, rate: 0 })
    if (liveRate > 0) lastRate.current = { currency, rate: liveRate }
    const exchangeRate = liveRate > 0 ? liveRate : lastRate.current.currency === currency ? lastRate.current.rate : 0
    // The dollar side of the request. Peanut settles in dollars, so the pay
    // link, the wallet and the share label all read this one. For a non-USD
    // request it is an estimate until the API answers with its own figure.
    const tokenValue = useMemo(
        () => (currency === 'USD' ? requestAmount : usdEquivalent(requestAmount, exchangeRate)),
        [currency, requestAmount, exchangeRate]
    )
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: merchantComment || '',
        fileUrl: '',
        rawFile: undefined,
    })
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [generatedLink, setGeneratedLink] = useState<string | null>(null)
    const [requestId, setRequestId] = useState<string | null>(null)
    const [isCreatingLink, setIsCreatingLink] = useState(false)
    const [isUpdatingRequest, setIsUpdatingRequest] = useState(false)
    // The opt-in defaults to the payable account's sender policy: it starts on
    // where a person can actually pay ('anyone' — USD, MXN, EUR) and off where
    // only a business can ('business-only' — GBP, COP, BRL). own-name-only has
    // no payable account, so the toggle is hidden and the default stays off.
    // The user can still change it; create is the only place it is read, so it
    // stays local state rather than url state — a shared link must not carry
    // the requester's choice.
    const depositAccountsEnabled = useDepositAccountsEnabled()
    const { accounts: depositAccounts, gates: depositGates } = useDepositAccounts({ enabled: depositAccountsEnabled })
    // Read the sender policy only of an account the payer could actually be given
    // — the same canShare test the toggle uses. Without the gate the default
    // turned bank-payment ON for a blocked or detail-less account whose toggle is
    // hidden, so the request shipped bankInstructionsShared with no way to unset it.
    const payableSender = useMemo(() => {
        if (!depositAccountsEnabled) return undefined
        const corridor = firstPayableCorridor(depositAccounts)
        const account = corridor ? depositAccounts[corridor] : undefined
        const gate = corridor ? depositGates[corridor] : undefined
        if (!account || !gate || !canShare(account, gate)) return undefined
        return account.matching.sender
    }, [depositAccountsEnabled, depositAccounts, depositGates])
    const [bankInstructionsShared, setBankInstructionsShared] = useState(false)
    // Once the user sets the toggle, the derived default stops overriding it.
    const bankInstructionsTouchedRef = useRef(false)
    useEffect(() => {
        if (bankInstructionsTouchedRef.current || requestId) return
        setBankInstructionsShared(payableSender === 'anyone')
    }, [payableSender, requestId])
    const handleBankInstructionsSharedChange = useCallback((value: boolean) => {
        bankInstructionsTouchedRef.current = true
        setBankInstructionsShared(value)
    }, [])

    // Debounced attachment options to prevent rapid API calls during typing
    const debouncedAttachmentOptions = useDebounce(attachmentOptions, 500)

    // Track the last saved state to determine if updates are needed
    const lastSavedAttachmentRef = useRef<IAttachmentOptions>({
        message: '',
        fileUrl: '',
        rawFile: undefined,
    })

    // Refs for cleanup
    const createLinkAbortRef = useRef<AbortController | null>(null)

    const _usdValue = useMemo(() => {
        if (!selectedTokenData?.price || !tokenValue) return ''
        return (parseFloat(tokenValue) * selectedTokenData.price).toString()
    }, [tokenValue, selectedTokenData?.price])

    // Harness-only: when the playwright session sets the passkey-bypass flag,
    // fall back to the user's peanut-wallet identifier (seeded by the harness)
    // so Create doesn't block on wagmi connection state. HARNESS_ENABLED is
    // inlined at build time — prod bundles tree-shake this entire branch.
    const harnessFallbackAddress = useMemo(() => {
        if (!HARNESS_ENABLED) return ''
        if (typeof window === 'undefined') return ''
        if (window.localStorage?.getItem('__harness_skip_passkey') !== 'true') return ''
        const peanutAccount = user?.accounts?.find((a) => a.type === 'peanut-wallet')
        return peanutAccount?.identifier || ''
    }, [user?.accounts])

    const recipientAddress = useMemo(() => {
        if (isConnected && address) return address
        return harnessFallbackAddress
    }, [isConnected, address, harnessFallbackAddress])

    const _isValidRecipient = useMemo(() => {
        return (isConnected && !!address) || !!harnessFallbackAddress
    }, [isConnected, address, harnessFallbackAddress])

    const _hasAttachment = useMemo(() => {
        return !!(attachmentOptions.rawFile || attachmentOptions.message)
    }, [attachmentOptions.rawFile, attachmentOptions.message])

    const qrCodeLink = useMemo(() => {
        if (generatedLink) return generatedLink

        if (tokenValue) return payLinkUrl(`/${user?.user.username}/${tokenValue}USDC`)
        return shareableUrl(`/send/${user?.user.username}`)
    }, [user?.user.username, tokenValue, generatedLink])

    // What a failed create says. A request asked in a fiat currency fails in
    // ways a dollar request cannot, and "failed to create link" tells the
    // requester nothing they can act on.
    const createErrorMessage = useCallback(
        (error: unknown) => {
            if (currency === 'USD') return t('errors.createFailed')
            const code = wireErrorCode(error)
            if (code === 'FX_UNAVAILABLE' || code === 'UNSUPPORTED_REQUEST_CURRENCY') {
                return t('errors.rateUnavailable', { currency })
            }
            if (code === 'INVALID_REQUESTED_AMOUNT') return t('errors.invalidRequestedAmount', { currency })
            if (apiErrorStatus(error) === 400 && !code) return t('errors.currencyNotAvailable', { currency })
            return t('errors.createFailed')
        },
        [currency, t]
    )

    const createRequestLink = useCallback(
        async (attachmentOptions: IAttachmentOptions) => {
            if (!recipientAddress) {
                setErrorState({
                    showError: true,
                    errorMessage: t('errors.enterRecipient'),
                })
                return null
            }
            // A request asked in a fiat currency always goes out with its dollar
            // estimate. With no rate yet there is none, and an API deployed
            // before `requestedAmount` would create an OPEN-amount request from
            // what is left of the body.
            const isDenominated = currency !== 'USD' && parseFloat(requestAmount) > 0
            if (isDenominated && !tokenValue) {
                setErrorState({ showError: true, errorMessage: t('errors.rateUnavailable', { currency }) })
                return null
            }
            // Cleanup previous request
            if (createLinkAbortRef.current) {
                createLinkAbortRef.current.abort()
            }
            createLinkAbortRef.current = new AbortController()

            setIsCreatingLink(true)
            setLoadingState('Creating link')
            setErrorState({ showError: false, errorMessage: '' })

            try {
                let tokenData: Pick<IToken, 'chainId' | 'address' | 'decimals' | 'symbol'>
                if (selectedTokenData) {
                    tokenData = {
                        chainId: selectedTokenData.chainId,
                        address: selectedTokenData.address,
                        decimals: selectedTokenData.decimals,
                        symbol: selectedTokenData.symbol,
                    }
                } else {
                    const tokenDetails = await fetchTokenDetails(selectedTokenAddress, selectedChainID)
                    tokenData = {
                        address: selectedTokenAddress,
                        chainId: selectedChainID,
                        symbol: (await fetchTokenSymbol(selectedTokenAddress, selectedChainID)) ?? '',
                        decimals: tokenDetails.decimals,
                    }
                }

                const tokenType = isNativeCurrency(tokenData.address)
                    ? peanutInterfaces.EPeanutLinkType.native
                    : peanutInterfaces.EPeanutLinkType.erc20

                const requestData = {
                    chainId: tokenData.chainId,
                    // For a non-USD request this is the client's estimate. The
                    // API ignores it and prices `requestedAmount` itself.
                    tokenAmount: tokenValue || undefined,
                    recipientAddress,
                    tokenAddress: tokenData.address,
                    tokenDecimals: tokenData.decimals.toString(),
                    tokenType: tokenType.valueOf().toString(),
                    tokenSymbol: tokenData.symbol,
                    reference: attachmentOptions.message || undefined,
                    attachment: attachmentOptions.rawFile || undefined,
                    mimeType: attachmentOptions.rawFile?.type || undefined,
                    filename: attachmentOptions.rawFile?.name || undefined,
                    bankInstructionsShared,
                    // Sent for a non-USD amount alone, so a USD request is the
                    // same body an API without the field accepts.
                    ...(isDenominated ? { requestedAmount: { amount: toApiAmount(requestAmount), currency } } : {}),
                }

                // POST new request
                const requestDetails = await requestsApi.create(requestData)

                // An API deployed before `requestedAmount` does not refuse the
                // field: the body schema strips it, and the request is created
                // in dollars for the client's estimate. The answer then carries
                // no `requestedAmount`. Sharing it as "100 EUR" would be false,
                // so it is closed and the create reads as failed. The close is
                // best effort: a request nobody was handed is harmless.
                if (isDenominated && !requestDetails.requestedAmount) {
                    await requestsApi.close(requestDetails.uuid).catch((error) => Sentry.captureException(error))
                    const errorMessage = t('errors.currencyNotAvailable', { currency })
                    setErrorState({ showError: true, errorMessage })
                    toast.error(errorMessage)
                    return null
                }
                setRequestId(requestDetails.uuid)

                const link = getRequestLink({
                    ...requestDetails,
                })

                // Update the last saved state
                lastSavedAttachmentRef.current = { ...attachmentOptions }

                queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                return link
            } catch (error) {
                if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
                    return null
                }
                const errorMessage = createErrorMessage(error)
                setErrorState({ showError: true, errorMessage })
                console.error('Failed to create link:', error)
                Sentry.captureException(error)
                toast.error(errorMessage)
                return null
            } finally {
                setLoadingState('Idle')
                setIsCreatingLink(false)
            }
        },
        [
            recipientAddress,
            tokenValue,
            requestAmount,
            currency,
            selectedTokenData,
            selectedTokenAddress,
            selectedChainID,
            bankInstructionsShared,
            createErrorMessage,
            toast,
            queryClient,
            setLoadingState,
            t,
        ]
    )

    const updateRequestLink = useCallback(
        async (attachmentOptions: IAttachmentOptions) => {
            if (!requestId) return null

            setIsUpdatingRequest(true)
            setLoadingState('Requesting')
            setErrorState({ showError: false, errorMessage: '' })

            try {
                const requestData = {
                    reference: attachmentOptions.message || undefined,
                    attachment: attachmentOptions.rawFile || undefined,
                    mimeType: attachmentOptions.rawFile?.type || undefined,
                    filename: attachmentOptions.rawFile?.name || undefined,
                }

                // PATCH existing request
                await requestsApi.update(requestId, requestData)

                // Update the last saved state
                lastSavedAttachmentRef.current = { ...attachmentOptions }

                toast.success(t('requestUpdatedToast'))
                queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                return generatedLink
            } catch (error) {
                setErrorState({
                    showError: true,
                    errorMessage: t('errors.updateFailed'),
                })
                console.error('Failed to update request:', error)
                Sentry.captureException(error)
                toast.error(t('errors.updateFailed'))
                return null
            } finally {
                setLoadingState('Idle')
                setIsUpdatingRequest(false)
            }
        },
        [requestId, generatedLink, toast, queryClient, setLoadingState, t]
    )

    const hasUnsavedChanges = useMemo(() => {
        if (!requestId) return false

        const lastSaved = lastSavedAttachmentRef.current
        return (
            lastSaved.message !== debouncedAttachmentOptions.message ||
            lastSaved.rawFile !== debouncedAttachmentOptions.rawFile
        )
    }, [requestId, debouncedAttachmentOptions.message, debouncedAttachmentOptions.rawFile])

    // Handle debounced attachment changes
    const handleDebouncedChange = useCallback(async () => {
        if (isCreatingLink || isUpdatingRequest) return

        if (requestId) {
            // Check for unsaved changes inline to avoid dependency issues
            const lastSaved = lastSavedAttachmentRef.current
            const hasChanges =
                lastSaved.message !== debouncedAttachmentOptions.message ||
                lastSaved.rawFile !== debouncedAttachmentOptions.rawFile

            if (hasChanges) {
                await updateRequestLink(debouncedAttachmentOptions)
            }
        }
    }, [debouncedAttachmentOptions, requestId, isCreatingLink, isUpdatingRequest, updateRequestLink])

    useEffect(() => {
        handleDebouncedChange()
    }, [handleDebouncedChange])

    const handleRequestAmountChange = useCallback(
        (value: string | undefined) => {
            // The amount is part of what the request was created with. Once it
            // exists the field is disabled, and every change that still arrives
            // is the input talking to itself: a currency swap, "100.50"
            // re-rendered as "100.5", a new FX rate. Treating those as edits
            // dropped the created request off the screen, and the Create button
            // that came back made a duplicate.
            if (requestId) return
            setRequestAmount(value || '')
        },
        [requestId]
    )

    // Both sides of the amount field, for a requester who swapped it to type
    // dollars — see `requestAmountFromInput`.
    const handleAmountInputChange = useCallback(
        (sides: AmountInputSides) => handleRequestAmountChange(requestAmountFromInput(sides, currency, exchangeRate)),
        [handleRequestAmountChange, currency, exchangeRate]
    )

    const handleCurrencyChange = useCallback(
        (value: string) => {
            const next = toSupportedExchangeCurrency(value)
            // The currency is part of what the request is created with, like
            // the amount: it cannot change once the request exists.
            if (!next || requestId) return
            setQuery({ currency: next === 'USD' ? null : next })
            setErrorState({ showError: false, errorMessage: '' })
        },
        [requestId, setQuery]
    )

    // The requester's own account currencies lead the picker: a request in the
    // currency of an account they hold is the one a payer can pay exactly.
    const accountCurrencies = useMemo(
        () => [
            ...new Set(
                Object.values(depositAccounts)
                    .filter((account) => account?.status === 'active')
                    .map((account) => account!.currency.toUpperCase())
            ),
        ],
        [depositAccounts]
    )

    const handleAttachmentOptionsChange = useCallback((options: IAttachmentOptions) => {
        setAttachmentOptions(options)
        setErrorState({ showError: false, errorMessage: '' })
    }, [])

    const handleTokenAmountSubmit = useCallback(async () => {
        if (!tokenValue || parseFloat(tokenValue) <= 0) return
        if (isCreatingLink || isUpdatingRequest) return // Prevent duplicate calls

        if (hasUnsavedChanges) {
            // PATCH: Update existing request
            await updateRequestLink(debouncedAttachmentOptions)
        }
    }, [
        tokenValue,
        debouncedAttachmentOptions,
        hasUnsavedChanges,
        updateRequestLink,
        isCreatingLink,
        isUpdatingRequest,
    ])

    const generateLink = useCallback(async () => {
        if (generatedLink) return generatedLink
        if (isCreatingLink || isUpdatingRequest) return '' // Prevent duplicate operations

        // reserved before the await: WebKit rejects a clipboard write once the
        // click's user activation is spent, and creating the request spends it
        const pendingCopy = beginClipboardCopy()

        // Create new request when share button is clicked
        const link = await createRequestLink(attachmentOptions)
        if (!link) {
            pendingCopy.cancel()
            return ''
        }

        setGeneratedLink(link)
        const copied = await pendingCopy.resolve(link)
        toast.success(copied ? t('linkCreatedAndCopiedToast') : t('linkCreatedToast'))
        return link
    }, [generatedLink, attachmentOptions, createRequestLink, isCreatingLink, isUpdatingRequest, toast, t])

    const resetRequest = useCallback(() => {
        createLinkAbortRef.current?.abort()
        createLinkAbortRef.current = null
        setRequestId(null)
        setGeneratedLink(null)
        setRequestAmount('')
        setAttachmentOptions({ message: '', fileUrl: '', rawFile: undefined })
        lastSavedAttachmentRef.current = { message: '', fileUrl: '', rawFile: undefined }
        bankInstructionsTouchedRef.current = false
        setBankInstructionsShared(payableSender === 'anyone')
        setErrorState({ showError: false, errorMessage: '' })
        void setQuery({ amount: null, merchant: null, currency: null })
    }, [payableSender, setQuery])

    // Set wallet defaults when connected
    useMemo(() => {
        if (isConnected && address) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isConnected, address, setSelectedChainID, setSelectedTokenAddress])

    return {
        tokenValue,
        requestAmount,
        currency,
        accountCurrencies,
        exchangeRate,
        attachmentOptions,
        errorState,
        generatedLink,
        requestId,
        isCreatingLink,
        isUpdatingRequest,
        qrCodeLink,
        bankInstructionsShared,
        setBankInstructionsShared: handleBankInstructionsSharedChange,
        handleRequestAmountChange,
        handleAmountInputChange,
        handleCurrencyChange,
        handleAttachmentOptionsChange,
        handleTokenAmountSubmit,
        generateLink,
        resetRequest,
    }
}
