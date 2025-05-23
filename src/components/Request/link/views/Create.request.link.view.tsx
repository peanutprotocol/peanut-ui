'use client'
import { fetchTokenDetails } from '@/app/actions/tokens'
import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import FileUploadInput, { IFileUploadInputProps } from '@/components/Global/FileUploadInput'
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

    const peanutWalletBalance = useMemo(() => {
        return printableUsdc(balance)
    }, [balance])

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

    const [_tokenValue, _setTokenValue] = useState<string>(tokenValue ?? '')

    // debounced token value
    const [debouncedTokenValue, setDebouncedTokenValue] = useState<string>(_tokenValue)
    const tokenDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    const hasAttachment = !!attachmentOptions?.rawFile || !!attachmentOptions?.message

    const qrCodeLink = useMemo(() => {
        if (generatedLink) return generatedLink

        // use debouncedTokenValue when in the process of creating a link with attachment
        const valueToShow = hasAttachment && isCreatingLink ? debouncedTokenValue : _tokenValue

        return `${window.location.origin}${valueToShow ? `/${user?.user.username}/${valueToShow}USDC` : `/pay/${user?.user.username}`}`
    }, [user?.user.username, _tokenValue, debouncedTokenValue, generatedLink, hasAttachment, isCreatingLink])

    const createRequestLink = useCallback(
        async ({
            recipientAddress,
            tokenAddress,
            chainId,
            tokenValue,
            tokenData,
            attachmentOptions,
        }: {
            recipientAddress: string | undefined
            tokenAddress: string
            chainId: string
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
                const tokenDetails = await fetchTokenDetails(tokenAddress, chainId)
                tokenData = {
                    address: tokenAddress,
                    chainId,
                    symbol: (await fetchTokenSymbol(tokenAddress, chainId)) ?? '',
                    decimals: tokenDetails.decimals,
                }
            }
            try {
                let inputValue = tokenValue
                const tokenType = isNativeCurrency(tokenData.address)
                    ? peanutInterfaces.EPeanutLinkType.native
                    : peanutInterfaces.EPeanutLinkType.erc20
                const requestDetails = await requestsApi.create({
                    chainId: tokenData.chainId,
                    tokenAmount: inputValue,
                    recipientAddress,
                    tokenAddress: tokenData.address,
                    tokenDecimals: tokenData.decimals.toString(),
                    tokenType: tokenType.valueOf().toString(),
                    tokenSymbol: tokenData.symbol,
                    reference: attachmentOptions?.message,
                    attachment: attachmentOptions?.rawFile,
                    mimeType: attachmentOptions?.rawFile?.type,
                    filename: attachmentOptions?.rawFile?.name,
                })
                chargesApi
                    .create({
                        pricing_type: 'fixed_price',
                        local_price: {
                            amount: requestDetails.tokenAmount,
                            currency: 'USD',
                        },
                        baseUrl: BASE_URL,
                        requestId: requestDetails.uuid,
                    })
                    .then(() => {
                        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                    })
                const link = getRequestLink(requestDetails)
                toast.success('Link created successfully!')
                return link
            } catch (error) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Failed to create link',
                })
                console.error('Failed to create link:', error)
                Sentry.captureException(error)
                toast.error('Failed to create link')
                return ''
            } finally {
                setLoadingState('Idle')
                setIsCreatingLink(false)
            }
        },
        [user?.user.username, toast]
    )

    const handleOnNext = useCallback(
        async ({
            recipientAddress,
            tokenAddress,
            chainId,
            tokenValue,
            tokenData,
            attachmentOptions,
        }: {
            recipientAddress: string | undefined
            tokenAddress: string
            chainId: string
            tokenValue: string | undefined
            tokenData: Pick<IToken, 'chainId' | 'address' | 'decimals' | 'symbol'> | undefined
            attachmentOptions: IFileUploadInputProps['attachmentOptions']
        }) => {
            const link = await createRequestLink({
                recipientAddress,
                tokenAddress,
                chainId,
                tokenValue,
                tokenData,
                attachmentOptions,
            })
            setGeneratedLink(link ?? null)
        },
        [createRequestLink]
    )

    const generateLink = useCallback(async () => {
        if (generatedLink) return generatedLink
        if (Number(tokenValue) === 0) return qrCodeLink
        setIsCreatingLink(true)
        const link = await createRequestLink({
            recipientAddress,
            tokenAddress: selectedTokenAddress,
            chainId: selectedChainID,
            tokenValue,
            tokenData: selectedTokenData,
            attachmentOptions: {
                message: ' ',
                fileUrl: undefined,
                rawFile: undefined,
            },
        })
        setGeneratedLink(link ?? null)
        setIsCreatingLink(false)
        return link ?? ''
    }, [
        generatedLink,
        qrCodeLink,
        tokenValue,
        selectedTokenAddress,
        selectedChainID,
        selectedTokenData,
        createRequestLink,
    ])

    useEffect(() => {
        if (!_tokenValue) return
        setTokenValue(_tokenValue)
        if (selectedTokenPrice) {
            setUsdValue((parseFloat(_tokenValue) * selectedTokenPrice).toString())
        }
    }, [_tokenValue])

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

        // reset error state when attachment options change
        setErrorState({ showError: false, errorMessage: '' })

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

    // debounce token value
    useEffect(() => {
        // clear timer
        if (tokenDebounceTimerRef.current) {
            clearTimeout(tokenDebounceTimerRef.current)
        }

        // set timer for the debounced update
        tokenDebounceTimerRef.current = setTimeout(() => {
            setDebouncedTokenValue(_tokenValue)
        }, 1000) // 1 second debounce

        // cleanup function
        return () => {
            if (tokenDebounceTimerRef.current) {
                clearTimeout(tokenDebounceTimerRef.current)
            }
        }
    }, [_tokenValue])

    // handle link creation based on input changes
    useEffect(() => {
        // only create link if there's an attachment, valid recipient, token value, and no link already being created and debounced token value matches the current token value
        if (
            hasAttachment &&
            isValidRecipient &&
            debouncedTokenValue &&
            !isCreatingLink &&
            debouncedTokenValue === _tokenValue
        ) {
            // check if we need to create a new link (either no link exists or token value changed)
            if (!generatedLink) {
                handleOnNext({
                    recipientAddress,
                    tokenAddress: selectedTokenAddress,
                    chainId: selectedChainID,
                    tokenValue,
                    tokenData: selectedTokenData,
                    attachmentOptions: debouncedAttachmentOptions,
                })
            }
        }
    }, [debouncedAttachmentOptions, debouncedTokenValue, isValidRecipient, isCreatingLink, generatedLink, _tokenValue])

    // check for token value debouncing
    const isDebouncing =
        (hasAttachment &&
            attachmentOptions?.message &&
            (!debouncedAttachmentOptions?.message ||
                debouncedAttachmentOptions.message !== attachmentOptions.message)) ||
        (hasAttachment && _tokenValue !== debouncedTokenValue)

    return (
        <div className="w-full space-y-8">
            <NavHeader onPrev={() => router.push('/request')} title="Request" />
            <div className="w-full space-y-4">
                <PeanutActionCard type="request" />

                <QRCodeWrapper url={qrCodeLink} isLoading={!!((hasAttachment && isCreatingLink) || isDebouncing)} />

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
                                tokenValue,
                                tokenData: selectedTokenData,
                                attachmentOptions,
                            })
                        }
                    }}
                    walletBalance={peanutWalletBalance}
                />
                <FileUploadInput
                    className="h-11"
                    placeholder="Comment"
                    attachmentOptions={attachmentOptions}
                    setAttachmentOptions={setAttachmentOptions}
                />

                {(hasAttachment && isCreatingLink) || isDebouncing ? (
                    <Button disabled={true} shadowSize="4">
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {' Loading'}
                        </div>
                    </Button>
                ) : (
                    <ShareButton generateUrl={generateLink}>Share Link</ShareButton>
                )}
                {errorState.showError && (
                    <div className="text-start">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
