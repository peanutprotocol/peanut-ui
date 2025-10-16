'use client'
import { fetchTokenDetails } from '@/app/actions/tokens'
import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import FileUploadInput from '@/components/Global/FileUploadInput'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { BASE_URL, PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { TRANSACTIONS } from '@/constants/query.consts'
import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IToken } from '@/interfaces'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { fetchTokenSymbol, getRequestLink, isNativeCurrency, printableUsdc } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export const CreateRequestLinkView = () => {
    const toast = useToast()
    const router = useRouter()
    const { address, isConnected, balance } = useWallet()
    const { user } = useAuth()
    const {
        selectedTokenPrice,
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        selectedTokenData,
    } = useContext(context.tokenSelectorContext)
    const { setLoadingState } = useContext(context.loadingStateContext)
    const queryClient = useQueryClient()

    // Core state
    const [tokenValue, setTokenValue] = useState<string>('')
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: '',
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

    // Derived state
    const peanutWalletBalance = useMemo(() => (balance !== undefined ? printableUsdc(balance) : ''), [balance])

    const usdValue = useMemo(() => {
        if (!selectedTokenPrice || !tokenValue) return ''
        return (parseFloat(tokenValue) * selectedTokenPrice).toString()
    }, [tokenValue, selectedTokenPrice])

    const recipientAddress = useMemo(() => {
        if (!isConnected || !address) return ''
        return address
    }, [isConnected, address])

    const isValidRecipient = useMemo(() => {
        return isConnected && !!address
    }, [isConnected, address])

    const hasAttachment = useMemo(() => {
        return !!(attachmentOptions.rawFile || attachmentOptions.message)
    }, [attachmentOptions.rawFile, attachmentOptions.message])

    const qrCodeLink = useMemo(() => {
        if (generatedLink) return generatedLink

        return `${window.location.origin}${
            tokenValue ? `/${user?.user.username}/${tokenValue}USDC` : `/send/${user?.user.username}`
        }`
    }, [user?.user.username, tokenValue, generatedLink])

    const createRequestLink = useCallback(
        async (attachmentOptions: IAttachmentOptions) => {
            if (!recipientAddress) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please enter a recipient address',
                })
                return null
            }

            if (!tokenValue || parseFloat(tokenValue) <= 0) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please enter a token amount',
                })
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
                    tokenAmount: tokenValue,
                    recipientAddress,
                    tokenAddress: tokenData.address,
                    tokenDecimals: tokenData.decimals.toString(),
                    tokenType: tokenType.valueOf().toString(),
                    tokenSymbol: tokenData.symbol,
                    reference: attachmentOptions.message || undefined,
                    attachment: attachmentOptions.rawFile || undefined,
                    mimeType: attachmentOptions.rawFile?.type || undefined,
                    filename: attachmentOptions.rawFile?.name || undefined,
                }

                // POST new request
                const requestDetails = await requestsApi.create(requestData)
                setRequestId(requestDetails.uuid)

                const link = getRequestLink({
                    ...requestDetails,
                })

                // Update the last saved state
                lastSavedAttachmentRef.current = { ...attachmentOptions }

                toast.success('Link created successfully!')
                queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                return link
            } catch (error) {
                if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
                    return null
                }
                setErrorState({
                    showError: true,
                    errorMessage: 'Failed to create link',
                })
                console.error('Failed to create link:', error)
                Sentry.captureException(error)
                toast.error('Failed to create link')
                return null
            } finally {
                setLoadingState('Idle')
                setIsCreatingLink(false)
            }
        },
        [
            recipientAddress,
            tokenValue,
            selectedTokenData,
            selectedTokenAddress,
            selectedChainID,
            toast,
            queryClient,
            setLoadingState,
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

                toast.success('Request updated successfully!')
                queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                return generatedLink
            } catch (error) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Failed to update request',
                })
                console.error('Failed to update request:', error)
                Sentry.captureException(error)
                toast.error('Failed to update request')
                return null
            } finally {
                setLoadingState('Idle')
                setIsUpdatingRequest(false)
            }
        },
        [requestId, generatedLink, toast, queryClient, setLoadingState]
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

        // If no request exists but we have content, create request
        if (!requestId && (debouncedAttachmentOptions.rawFile || debouncedAttachmentOptions.message)) {
            if (!tokenValue || parseFloat(tokenValue) <= 0) return

            const link = await createRequestLink(debouncedAttachmentOptions)
            if (link) {
                setGeneratedLink(link)
            }
        }
        // If request exists and content changed (including clearing), update it
        else if (requestId) {
            // Check for unsaved changes inline to avoid dependency issues
            const lastSaved = lastSavedAttachmentRef.current
            const hasChanges =
                lastSaved.message !== debouncedAttachmentOptions.message ||
                lastSaved.rawFile !== debouncedAttachmentOptions.rawFile

            if (hasChanges) {
                await updateRequestLink(debouncedAttachmentOptions)
            }
        }
    }, [
        debouncedAttachmentOptions,
        requestId,
        tokenValue,
        isCreatingLink,
        isUpdatingRequest,
        createRequestLink,
        updateRequestLink,
    ])

    useEffect(() => {
        handleDebouncedChange()
    }, [handleDebouncedChange])

    const handleTokenValueChange = useCallback(
        (value: string | undefined) => {
            const newValue = value || ''
            setTokenValue(newValue)

            // Reset link and request when token value changes
            if (newValue !== tokenValue) {
                setGeneratedLink(null)
                setRequestId(null)
                lastSavedAttachmentRef.current = {
                    message: '',
                    fileUrl: '',
                    rawFile: undefined,
                }
            }
        },
        [tokenValue]
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
        if (Number(tokenValue) === 0) return qrCodeLink
        if (isCreatingLink || isUpdatingRequest) return '' // Prevent duplicate operations

        // Create new request when share button is clicked
        const link = await createRequestLink(attachmentOptions)
        if (link) {
            setGeneratedLink(link)
        }
        return link || ''
    }, [generatedLink, qrCodeLink, tokenValue, attachmentOptions, createRequestLink, isCreatingLink, isUpdatingRequest])

    // Set wallet defaults when connected
    useMemo(() => {
        if (isConnected && address) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isConnected, address, setSelectedChainID, setSelectedTokenAddress])

    return (
        <div className="flex min-h-[inherit] w-full flex-col justify-start space-y-8">
            <NavHeader onPrev={() => router.push('/home')} title="Request" />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                <PeanutActionCard type="request" />

                <QRCodeWrapper url={qrCodeLink} isLoading={isCreatingLink || isUpdatingRequest} />

                <TokenAmountInput
                    className="w-full"
                    setTokenValue={handleTokenValueChange}
                    tokenValue={tokenValue}
                    onSubmit={handleTokenAmountSubmit}
                    walletBalance={peanutWalletBalance}
                    disabled={!!requestId}
                    showInfoText
                    infoText="Leave empty to let payers choose amounts."
                />

                <FileUploadInput
                    className="h-11"
                    placeholder="Comment"
                    attachmentOptions={attachmentOptions}
                    setAttachmentOptions={handleAttachmentOptionsChange}
                />

                {isCreatingLink || isUpdatingRequest ? (
                    <Button disabled={true} shadowSize="4">
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> Loading
                        </div>
                    </Button>
                ) : (
                    <ShareButton generateUrl={generateLink}>
                        {tokenValue.length === 0 || parseFloat(tokenValue) === 0
                            ? 'Share open request'
                            : `Share $${tokenValue} request`}
                    </ShareButton>
                )}

                {errorState.showError && (
                    <div className="text-start">
                        <label className="text-h8 font-normal text-red">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
