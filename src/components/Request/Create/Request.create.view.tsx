'use client'
import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { IAttachmentOptions } from '@/components/Create/Create.consts'
import { getTokenDetails } from '@/components/Create/Create.utils'
import FileUploadInput, { IFileUploadInputProps } from '@/components/Global/FileUploadInput'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import ShareButton from '@/components/Global/ShareButton'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IToken, IUserBalance } from '@/interfaces'
import { fetchTokenSymbol, fetchWithSentry, getRequestLink, isNativeCurrency } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export const RequestCreateView = () => {
    const toast = useToast()
    const { address, selectedWallet, isConnected } = useWallet()
    const { user } = useAuth()
    const {
        selectedTokenPrice,
        inputDenomination,
        selectedChainID,
        setSelectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        selectedTokenData,
    } = useContext(context.tokenSelectorContext)
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)

    // component-specific states
    const [tokenValue, setTokenValue] = useState<undefined | string>(undefined)
    const [usdValue, setUsdValue] = useState<undefined | string>(undefined)
    const [attachmentOptions, setAttachmentOptions] = useState<IAttachmentOptions>({
        message: '',
        fileUrl: '',
        rawFile: undefined,
    })
    const [recipientAddress, setRecipientAddress] = useState<string>('')
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [generatedLink, setGeneratedLink] = useState<string | null>(null)
    const [isCreatingLink, setIsCreatingLink] = useState(false)
    const [debouncedAttachmentOptions, setDebouncedAttachmentOptions] =
        useState<IFileUploadInputProps['attachmentOptions']>(attachmentOptions)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const [_tokenValue, _setTokenValue] = useState<string>(
        (inputDenomination === 'TOKEN' ? tokenValue : usdValue) ?? ''
    )

    const qrCodeLink = useMemo(() => {
        if (generatedLink) return generatedLink
        return `${window.location.origin}/${user?.user.username}${_tokenValue ? `/${_tokenValue}USDC` : ''}`
    }, [user?.user.username, _tokenValue, generatedLink])

    const handleOnNext = useCallback(
        async ({
            recipientAddress,
            tokenAddress,
            chainId,
            userBalances,
            tokenValue,
            tokenData,
            attachmentOptions,
        }: {
            recipientAddress: string | undefined
            tokenAddress: string
            chainId: string
            userBalances: IUserBalance[]
            tokenValue: string | undefined
            tokenData: Pick<IToken, 'chainId' | 'address' | 'decimals' | 'symbol'> | undefined
            attachmentOptions: IFileUploadInputProps['attachmentOptions']
        }) => {
            if (!recipientAddress) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please enter a recipient address',
                })
                return
            }
            if (!tokenValue) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please enter a token amount',
                })
                return
            }

            setIsCreatingLink(true)
            setLoadingState('Creating link')

            if (!tokenData) {
                const tokenDetails = getTokenDetails(tokenAddress, chainId, userBalances)
                tokenData = {
                    address: tokenAddress,
                    chainId,
                    symbol: (await fetchTokenSymbol(tokenAddress, chainId)) ?? '',
                    decimals: tokenDetails.tokenDecimals,
                }
            }
            try {
                let inputValue = tokenValue
                if (inputDenomination === 'USD') {
                    inputValue = parseFloat(tokenValue as string).toFixed(tokenData.decimals)
                }
                const tokenType = isNativeCurrency(tokenData.address)
                    ? peanutInterfaces.EPeanutLinkType.native
                    : peanutInterfaces.EPeanutLinkType.erc20
                const createFormData = new FormData()
                createFormData.append('chainId', tokenData.chainId)
                createFormData.append('recipientAddress', recipientAddress)
                createFormData.append('tokenAddress', tokenData.address)
                createFormData.append('tokenAmount', inputValue)
                createFormData.append('tokenDecimals', tokenData.decimals.toString())
                createFormData.append('tokenType', tokenType.valueOf().toString())
                createFormData.append('tokenSymbol', tokenData.symbol)
                if (attachmentOptions?.rawFile) {
                    createFormData.append('attachment', attachmentOptions.rawFile)
                    createFormData.append('mimetype', attachmentOptions.rawFile.type)
                    createFormData.append('filename', attachmentOptions.rawFile.name)
                }
                if (attachmentOptions?.message) {
                    createFormData.append('reference', attachmentOptions.message)
                }
                const requestResponse = await fetchWithSentry('/api/proxy/withFormData/requests', {
                    method: 'POST',
                    body: createFormData,
                })
                if (!requestResponse.ok) {
                    throw new Error(`Request failed: ${requestResponse.status}`)
                }
                const requestLinkDetails = await requestResponse.json()
                const link = getRequestLink(requestLinkDetails)
                requestLinkDetails.link = link

                setGeneratedLink(link)
                toast.success('Link created successfully!')
                // onNext()
            } catch (error) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Failed to create link',
                })
                console.error('Failed to create link:', error)
                Sentry.captureException(error)
                toast.error('Failed to create link')
            } finally {
                setLoadingState('Idle')
                setIsCreatingLink(false)
            }
        },
        [user?.user.username, toast]
    )

    useEffect(() => {
        if (!_tokenValue) return
        if (inputDenomination === 'TOKEN') {
            setTokenValue(_tokenValue)
            if (selectedTokenPrice) {
                setUsdValue((parseFloat(_tokenValue) * selectedTokenPrice).toString())
            }
        } else if (inputDenomination === 'USD') {
            setUsdValue(_tokenValue)
            if (selectedTokenPrice) {
                setTokenValue((parseFloat(_tokenValue) / selectedTokenPrice).toString())
            }
        }
    }, [_tokenValue, inputDenomination])

    useEffect(() => {
        if (!isConnected) {
            setRecipientAddress('')
            setIsValidRecipient(false)
            return
        }

        if (address) {
            // reset states first
            setRecipientAddress('')
            setIsValidRecipient(false)

            // set recipient to connected wallet address with a delay
            setTimeout(() => {
                setRecipientAddress(address)
                setIsValidRecipient(true)
            }, 100)

            // set chain and token for Peanut Wallet
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isConnected, address])

    // debounce attachment options changes, especially for text messages
    useEffect(() => {
        // clear any existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // check if attachments are completely cleared
        const hasNoAttachments = !attachmentOptions?.rawFile && !attachmentOptions?.message

        if (hasNoAttachments) {
            // reset generated link when attachments are completely cleared
            setGeneratedLink(null)
        } else {
            // reset generated link when attachment options change (adding or modifying)
            setGeneratedLink(null)
        }

        // for file attachments, update immediately
        if (attachmentOptions?.rawFile) {
            setDebouncedAttachmentOptions(attachmentOptions)
            return
        }

        // for text messages, debounce for 3 seconds
        if (attachmentOptions?.message) {
            // set a timer for the debounced update
            debounceTimerRef.current = setTimeout(() => {
                setDebouncedAttachmentOptions(attachmentOptions)
            }, 3000) // 3 second debounce
        } else {
            // If no message, update immediately
            setDebouncedAttachmentOptions(attachmentOptions)
        }

        // cleanup function
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [attachmentOptions])

    // automatically create link when attachment is added (with a debounce)
    useEffect(() => {
        const hasAttachment = !!debouncedAttachmentOptions?.rawFile || !!debouncedAttachmentOptions?.message

        // only create link if there's an attachment, valid recipient, token value, and no link already being created
        if (hasAttachment && isValidRecipient && _tokenValue && !isCreatingLink && !generatedLink) {
            handleOnNext({
                recipientAddress,
                tokenAddress: selectedTokenAddress,
                chainId: selectedChainID,
                userBalances: selectedWallet?.balances ?? [],
                tokenValue,
                tokenData: selectedTokenData,
                attachmentOptions: debouncedAttachmentOptions,
            })
        }
    }, [
        debouncedAttachmentOptions,
        isValidRecipient,
        _tokenValue,
        isCreatingLink,
        generatedLink,
        recipientAddress,
        selectedTokenAddress,
        selectedChainID,
        selectedWallet?.balances,
        tokenValue,
        selectedTokenData,
        handleOnNext,
    ])

    const hasAttachment = !!attachmentOptions?.rawFile || !!attachmentOptions?.message
    const isDebouncing =
        hasAttachment &&
        attachmentOptions?.message &&
        (!debouncedAttachmentOptions?.message || debouncedAttachmentOptions.message !== attachmentOptions.message)

    return (
        <div className="space-y-4">
            <NavHeader title="Request" href="/home" />
            <div className="flex w-full flex-col items-center justify-center gap-3">
                <div className="space-y-3">
                    <QRCodeWrapper url={qrCodeLink} isLoading={!!((hasAttachment && isCreatingLink) || isDebouncing)} />
                    <div className="text-center text-gray-1">Show this QR to your friends!</div>
                </div>
                <TokenAmountInput
                    className="w-full"
                    setTokenValue={(value) => {
                        _setTokenValue(value ?? '')
                        // reset generated link when token value changes
                        setGeneratedLink(null)
                    }}
                    tokenValue={_tokenValue}
                    onSubmit={() => {
                        if (hasAttachment && !generatedLink && !isDebouncing) {
                            handleOnNext({
                                recipientAddress,
                                tokenAddress: selectedTokenAddress,
                                chainId: selectedChainID,
                                userBalances: selectedWallet?.balances ?? [],
                                tokenValue,
                                tokenData: selectedTokenData,
                                attachmentOptions,
                            })
                        }
                    }}
                />
                <FileUploadInput attachmentOptions={attachmentOptions} setAttachmentOptions={setAttachmentOptions} />

                {(hasAttachment && isCreatingLink) || isDebouncing ? (
                    <Button disabled={true} shadowSize="4">
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {isLoading || isDebouncing ? 'Loading' : 'Creating link'}
                        </div>
                    </Button>
                ) : (
                    <ShareButton url={qrCodeLink}>Share Link</ShareButton>
                )}
            </div>
            {errorState.showError && (
                <div className="text-start">
                    <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                </div>
            )}
        </div>
    )
}
