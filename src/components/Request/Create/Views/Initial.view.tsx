import TokenAmountInput from '@/components/Global/TokenAmountInput'
import * as _consts from '../Create.consts'
import FileUploadInput from '@/components/Global/FileUploadInput'
import AddressInput from '@/components/Global/AddressInput'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useContext, useState } from 'react'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { peanut } from '@squirrel-labs/peanut-sdk'
export const InitialView = ({ onNext, onPrev }: _consts.ICreateScreenProps) => {
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const { selectedTokenPrice, inputDenomination, selectedChainID, selectedTokenAddress } = useContext(
        context.tokenSelectorContext
    )
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [recipientAddress, setRecipientAddress] = useState<string>('')
    const [tokenValue, setTokenValue] = useState<string>('')
    const handleConnectWallet = async () => {
        open()
    }

    const handleOnNext = async () => {
        // TODO: add validation for recipient address

        const link = await peanut.createRequestLink({
            chainId: selectedChainID,
            recipientAddress: recipientAddress,
            tokenAddress: selectedTokenAddress,
            tokenAmount: tokenValue,
            tokenDecimals: 18,
            tokenType: 1,
        })

        console.log(link)
        onNext()
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label
                className="max-h-[92px] w-full overflow-hidden text-h2"
                style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical' }}
            >
                Request a payment
            </label>
            <label className="w-full max-w-96 text-start text-h8 font-light">
                You will request a payment to 0x... <br />
                Choose your preffered token and chain.
            </label>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <TokenAmountInput
                    className="w-full"
                    setTokenValue={(value) => {
                        setTokenValue(value ?? '')
                    }}
                    tokenValue={tokenValue}
                />
                <TokenSelector classNameButton="w-full" />

                <FileUploadInput
                    attachmentOptions={{
                        message: '',
                        fileUrl: '',
                        rawFile: undefined,
                    }}
                    setAttachmentOptions={() => {}}
                />
                <AddressInput
                    value={recipientAddress}
                    setRecipientType={() => {}}
                    _setIsValidRecipient={() => {}}
                    onDeleteClick={() => {}}
                    onSubmit={(recipient: string) => {
                        setRecipientAddress(recipient)
                    }}
                    placeholder="Enter recipient address"
                    className="w-full"
                />
                {/* TODO: fix this input to only accept addresses and nothing else */}
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-3">
                <button
                    className="wc-disable-mf btn-purple btn-xl "
                    onClick={() => {
                        if (!isConnected) handleConnectWallet()
                        else handleOnNext()
                    }}
                    disabled={isLoading}
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
