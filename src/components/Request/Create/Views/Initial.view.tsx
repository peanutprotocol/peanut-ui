import TokenAmountInput from '@/components/Global/TokenAmountInput'
import * as _consts from '../Create.consts'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useContext, useEffect, useState } from 'react'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { peanut } from '@squirrel-labs/peanut-sdk'
import * as consts from '@/constants'
import AddressInput from '@/components/Global/AddressInput'
import { getTokenDetails } from '@/components/Create/Create.utils'
import { useBalance } from '@/hooks/useBalance'

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
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const { balances } = useBalance()
    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress } = useContext(
        context.tokenSelectorContext
    )
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const [_tokenValue, _setTokenValue] = useState<string | undefined>(
        inputDenomination === 'TOKEN' ? tokenValue : usdValue
    )

    const handleConnectWallet = async () => {
        open()
    }

    const handleOnNext = async () => {
        // TODO: add validation for recipient address

        const tokenDetails = getTokenDetails(selectedTokenAddress, selectedChainID, balances)

        const { link } = await peanut.createRequestLink({
            chainId: selectedChainID,
            recipientAddress: recipientAddress, // TODO: check wether works with ens name or not
            tokenAddress: selectedTokenAddress,
            tokenAmount: _tokenValue ?? '',
            tokenDecimals: tokenDetails.tokenDecimals,
            tokenType: tokenDetails.tokenType,
            apiUrl: `${consts.next_proxy_url}`,
            baseUrl: `http://localhost:3000/request/pay`,
            APIKey: 'doesnt-matter',
        })

        setLink(link)
        onNext()
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
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label
                className="max-h-[92px] w-full overflow-hidden text-h2"
                style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}
            >
                Request a payment
            </label>
            <label className="w-full max-w-96 text-start text-h8 font-light">
                You will request a payment to {recipientAddress ? recipientAddress : '...'} <br />
                Choose your preffered token and chain.
            </label>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput
                    className="w-full"
                    setTokenValue={(value) => {
                        _setTokenValue(value ?? '')
                    }}
                    tokenValue={_tokenValue}
                    onSubmit={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                />
                <TokenSelector classNameButton="w-full" />

                <FileUploadInput attachmentOptions={attachmentOptions} setAttachmentOptions={setAttachmentOptions} />
                <AddressInput
                    value={recipientAddress}
                    _setIsValidRecipient={() => {
                        setIsValidRecipient(true)
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
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <button
                    className="wc-disable-mf btn-purple btn-xl "
                    onClick={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                    disabled={!isValidRecipient || inputChanging || isLoading}
                >
                    {/* TODO: ^ tokenValueCheck */}
                    {!isConnected ? (
                        'Create or Connect Wallet'
                    ) : isLoading ? (
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
