import TokenAmountInput from '@/components/Global/TokenAmountInput'
import * as _consts from '../Create.consts'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { useContext, useEffect, useState } from 'react'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { peanut } from '@squirrel-labs/peanut-sdk'
import AddressInput from '@/components/Global/AddressInput'
import { getTokenDetails } from '@/components/Create/Create.utils'
import { useBalance } from '@/hooks/useBalance'
import * as utils from '@/utils'
import { Button, Card } from '@/components/0_Bruddle'

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
    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress, selectedTokenDecimals } =
        useContext(context.tokenSelectorContext)
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const [_tokenValue, _setTokenValue] = useState<string>(
        (inputDenomination === 'TOKEN' ? tokenValue : usdValue) ?? ''
    )

    const handleOnNext = async () => {
        if (!recipientAddress) {
            setErrorState({
                showError: true,
                errorMessage: 'Please enter a recipient address',
            })
            return
        }

        setLoadingState('Creating link')

        const tokenDetails = getTokenDetails(selectedTokenAddress, selectedChainID, balances)
        try {
            let inputValue = tokenValue ?? ''
            if (inputDenomination === 'USD') {
                inputValue = parseFloat(tokenValue as string).toFixed(selectedTokenDecimals)
            }
            const { link } = await peanut.createRequestLink({
                chainId: selectedChainID,
                recipientAddress: recipientAddress,
                tokenAddress: selectedTokenAddress,
                tokenAmount: inputValue,
                tokenDecimals: tokenDetails.tokenDecimals.toString(),
                tokenType: tokenDetails.tokenType,
                apiUrl: '/api/proxy/withFormData',
                baseUrl: `${window.location.origin}/request/pay`,
                APIKey: 'doesnt-matter',
                attachment: attachmentOptions?.rawFile || undefined,
                reference: attachmentOptions?.message || undefined,
            })

            const requestLinkDetails: any = await peanut.getRequestLinkDetails({ link: link, apiUrl: '/api/proxy/get' })
            utils.saveRequestLinkToLocalStorage({ details: requestLinkDetails })

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
    }

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
        <div className="flex w-full flex-col items-center justify-center gap-6">
            <Card>
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
                                handleOnNext()
                            }}
                        />
                        <TokenSelector classNameButton="w-full" shouldBeConnected={false} />

                        <FileUploadInput
                            attachmentOptions={attachmentOptions}
                            setAttachmentOptions={setAttachmentOptions}
                        />
                        <AddressInput
                            value={recipientAddress ?? ''}
                            _setIsValidRecipient={(valid: boolean) => {
                                setIsValidRecipient(valid)
                                setInputChanging(false)
                            }}
                            onDeleteClick={() => {
                                setRecipientAddress('')
                                setInputChanging(false)
                            }}
                            onSubmit={(recipient: string) => {
                                setRecipientAddress(recipient)
                                setInputChanging(false)
                            }}
                            setIsValueChanging={(value: boolean) => {
                                setInputChanging(value)
                            }}
                            placeholder="Enter recipient address"
                            className="w-full"
                        />
                        <Button
                            onClick={() => {
                                handleOnNext()
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
                        <div className="text-center">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                </Card.Content>
            </Card>
        </div>
    )
}
