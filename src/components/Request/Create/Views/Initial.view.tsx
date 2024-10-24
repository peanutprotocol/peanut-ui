import TokenAmountInput from '@/components/Global/TokenAmountInput'
import * as _consts from '../Create.consts'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { useContext, useEffect, useState, useCallback } from 'react'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import AddressInput from '@/components/Global/AddressInput'
import { InputUpdate } from '@/components/Global/ValidatedInput'
import { getTokenDetails } from '@/components/Create/Create.utils'
import { useBalance } from '@/hooks/useBalance'
import { getTokenSymbol, saveRequestLinkToLocalStorage, isNativeCurrency } from '@/utils'
import { IUserBalance, IToken } from '@/interfaces'

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
    const { balances } = useBalance()
    const {
        selectedTokenPrice,
        inputDenomination,
        selectedChainID,
        selectedTokenAddress,
        selectedTokenDecimals,
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
        }: {
            recipientAddress: string | undefined
            tokenAddress: string
            chainId: string
            userBalances: IUserBalance[]
            tokenValue: string | undefined
            tokenData: Pick<IToken, 'chainId' | 'address' | 'decimals' | 'symbol'> | undefined
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
                    symbol: (await getTokenSymbol(tokenAddress, chainId)) ?? '',
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
                const { link } = await peanut.createRequestLink({
                    chainId: tokenData.chainId,
                    recipientAddress,
                    tokenAddress: tokenData.address,
                    tokenAmount: inputValue,
                    tokenDecimals: tokenData.decimals.toString(),
                    tokenType,
                    tokenSymbol: tokenData.symbol,
                    apiUrl: '/api/proxy/withFormData',
                    baseUrl: `${window.location.origin}/request/pay`,
                    attachment: attachmentOptions?.rawFile || undefined,
                    reference: attachmentOptions?.message || undefined,
                })

                const requestLinkDetails: any = await peanut.getRequestLinkDetails({ link, apiUrl: '/api/proxy/get' })
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

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label
                className="max-h-[92px] w-full overflow-hidden text-h2"
                style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}
            >
                Request a payment
            </label>
            <label className="w-full max-w-96 text-start text-h8 font-light">
                Choose the amount, token and chain. You will request a payment to your wallet. Add an invoice if you
                want to.
            </label>

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
                            userBalances: balances,
                            tokenValue: _tokenValue,
                            tokenData: selectedTokenData,
                        })
                    }}
                />
                <TokenSelector classNameButton="w-full" shouldBeConnected={false} />

                <FileUploadInput attachmentOptions={attachmentOptions} setAttachmentOptions={setAttachmentOptions} />
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
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <button
                    className="wc-disable-mf btn-purple btn-xl "
                    onClick={() => {
                        handleOnNext({
                            recipientAddress,
                            tokenAddress: selectedTokenAddress,
                            chainId: selectedChainID,
                            userBalances: balances,
                            tokenValue: _tokenValue,
                            tokenData: selectedTokenData,
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
                </button>
                <button className="btn btn-xl" onClick={onPrev} disabled={isLoading}>
                    Return
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
