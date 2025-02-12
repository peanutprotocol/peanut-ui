import { Button, Card } from '@/components/0_Bruddle'
import { getTokenDetails } from '@/components/Create/Create.utils'
import AddressInput from '@/components/Global/AddressInput'
import FileUploadInput, { IFileUploadInputProps } from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import Loading from '@/components/Global/Loading'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { InputUpdate } from '@/components/Global/ValidatedInput'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IToken, IUserBalance } from '@/interfaces'
import { fetchTokenSymbol, isNativeCurrency, saveRequestLinkToLocalStorage } from '@/utils'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useState } from 'react'
import * as _consts from '../Create.consts'

export const InitialView = ({
    onNext,
    onPrev,
    setLink,
    setAttachmentOptions,
    attachmentOptions,
    tokenValue,
    setTokenValue,
    usdValue,
    setUsdValue,
    recipientAddress,
    setRecipientAddress,
}: _consts.ICreateScreenProps) => {
    const { selectedWallet, isExternalWallet, isPeanutWallet } = useWallet()
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
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const [_tokenValue, _setTokenValue] = useState<string>(
        (inputDenomination === 'TOKEN' ? tokenValue : usdValue) ?? ''
    )

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
                }
                if (attachmentOptions?.message) {
                    createFormData.append('reference', attachmentOptions.message)
                }
                const requestResponse = await fetch('/api/proxy/withFormData/requests', {
                    method: 'POST',
                    body: createFormData,
                })
                const requestLinkDetails = await requestResponse.json()

                //TODO: create util function to generate link
                //TODO: use human readeable instead of address
                let link = `${process.env.NEXT_PUBLIC_BASE_URL}/${requestLinkDetails.recipientAddress}/`
                if (requestLinkDetails.tokenAmount) {
                    link += `${requestLinkDetails.tokenAmount}`
                }
                if (requestLinkDetails.tokenSymbol) {
                    link += `${requestLinkDetails.tokenSymbol}`
                }
                link += `?id=${requestLinkDetails.uuid}`

                //TODO: remove after history implementation.
                requestLinkDetails.link = link
                saveRequestLinkToLocalStorage({ details: requestLinkDetails })

                setLink(link)
                onNext()
            } catch (error) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Failed to create link',
                })
                console.error('Failed to create link:', error)
            } finally {
                setLoadingState('Idle')
            }
        },
        []
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

    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [inputChanging, setInputChanging] = useState(false)

    useEffect(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        }
    }, [isPeanutWallet])

    useEffect(() => {
        if (isPeanutWallet && selectedWallet) {
            setRecipientAddress(selectedWallet.address)
            setIsValidRecipient(true)
        }
    }, [isPeanutWallet, selectedWallet?.address])

    return (
        <div>
            <FlowHeader />
            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title>Request a payment</Card.Title>
                    <Card.Description>
                        Choose the amount, token and chain. You will request a payment to your wallet. Add an invoice if
                        you want to.
                    </Card.Description>
                </Card.Header>
                <Card.Content>
                    <div className="flex w-full flex-col items-center justify-center gap-3">
                        <TokenAmountInput
                            className="w-full"
                            setTokenValue={(value) => {
                                _setTokenValue(value ?? '')
                            }}
                            tokenValue={_tokenValue}
                            onSubmit={() => {
                                handleOnNext({
                                    recipientAddress,
                                    tokenAddress: selectedTokenAddress,
                                    chainId: selectedChainID,
                                    userBalances: selectedWallet?.balances ?? [],
                                    tokenValue,
                                    tokenData: selectedTokenData,
                                    attachmentOptions,
                                })
                            }}
                        />
                        {isExternalWallet && <TokenSelector shouldBeConnected={false} />}
                        <FileUploadInput
                            attachmentOptions={attachmentOptions}
                            setAttachmentOptions={setAttachmentOptions}
                        />
                        {isExternalWallet && (
                            <AddressInput
                                placeholder="Enter recipient address"
                                value={recipientAddress ?? ''}
                                onUpdate={(update: InputUpdate) => {
                                    setRecipientAddress(update.value)
                                    setInputChanging(update.isChanging)
                                    setIsValidRecipient(update.isValid)
                                }}
                                className="w-full"
                            />
                        )}
                        <Button
                            onClick={() => {
                                handleOnNext({
                                    recipientAddress,
                                    tokenAddress: selectedTokenAddress,
                                    chainId: selectedChainID,
                                    userBalances: selectedWallet?.balances ?? [],
                                    tokenValue,
                                    tokenData: selectedTokenData,
                                    attachmentOptions,
                                })
                            }}
                            disabled={!isValidRecipient || inputChanging || isLoading || !_tokenValue}
                        >
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading /> {loadingState}
                                </div>
                            ) : (
                                'Confirm'
                            )}
                        </Button>
                    </div>
                    {errorState.showError && (
                        <div className="text-start">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                </Card.Content>
            </Card>
        </div>
    )
}
