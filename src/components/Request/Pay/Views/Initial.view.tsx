import TokenAmountInput from '@/components/Global/TokenAmountInput'
import * as _consts from '../Pay.consts'
import FileUploadInput from '@/components/Global/FileUploadInput'
import AddressInput from '@/components/Global/AddressInput'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useContext, useState } from 'react'
import * as context from '@/context'
import Loading from '@/components/Global/Loading'
import * as utils from '@/utils'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import * as consts from '@/constants'
export const InitialView = ({
    onNext,
    requestLinkData,
    estimatedPoints,
    setTransactionHash,
}: _consts.IPayScreenProps) => {
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

    const handleConnectWallet = async () => {
        open()
    }

    const handleOnNext = () => {
        setTransactionHash('0x1234567890')
        onNext()
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            {(requestLinkData.attachmentInfo?.message || requestLinkData.attachmentInfo?.attachmentUrl) && (
                <>
                    <div className={`flex w-full flex-col items-center justify-center  gap-2`}>
                        {requestLinkData.attachmentInfo?.message && (
                            <label className="max-w-full text-h8">
                                Ref: <span className="font-normal"> {requestLinkData.attachmentInfo?.message} </span>
                            </label>
                        )}
                        {requestLinkData.attachmentInfo?.attachmentUrl && (
                            <a
                                href={requestLinkData.attachmentInfo?.attachmentUrl}
                                download
                                target="_blank"
                                className="flex w-full cursor-pointer flex-row items-center justify-center gap-1 text-h9 font-normal text-gray-1 underline "
                            >
                                <Icon name={'download'} />
                                Download attachment
                            </a>
                        )}
                    </div>
                    <div className="flex w-full border-t border-dotted border-black" />
                </>
            )}

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <label className="text-h4">{utils.shortenAddress(requestLinkData.requestAddress)} is requesting</label>
                {requestLinkData.tokenPrice ? (
                    <label className="text-h2">
                        $ {utils.formatTokenAmount(Number(requestLinkData.tokenAmount) * requestLinkData.tokenPrice)}
                    </label>
                ) : (
                    <label className="text-h2 ">
                        {requestLinkData.tokenAmount} {requestLinkData.tokenSymbol}
                    </label>
                )}
                <div>
                    <div className="flex flex-row items-center justify-center gap-2 pl-1 text-h7">
                        <div className="relative h-6 w-6">
                            <img
                                src={
                                    consts.peanutTokenDetails
                                        .find((chain) => chain.chainId === requestLinkData.chainId)
                                        ?.tokens.find((token) => token.address === requestLinkData.tokenAddress)
                                        ?.logoURI
                                }
                                className="absolute left-0 top-0 h-6 w-6"
                                alt="logo"
                            />
                            <img
                                src={
                                    consts.supportedPeanutChains.find(
                                        (chain) => chain.chainId === requestLinkData.chainId
                                    )?.icon.url
                                }
                                className="absolute -top-1 left-3 h-4 w-4 rounded-full" // Adjust `left-3` to control the overlap
                                alt="logo"
                            />
                        </div>
                        12 MATIC on POLYGON
                    </div>
                </div>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fees</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        $0.00 <MoreInfo text={'This transaction is sponsored by peanut! Enjoy!'} />
                    </span>
                </div>

                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {estimatedPoints < 0 ? estimatedPoints : `+${estimatedPoints}`}
                        <MoreInfo
                            text={
                                estimatedPoints
                                    ? estimatedPoints > 0
                                        ? `This transaction will add ${estimatedPoints} to your total points balance.`
                                        : 'This transaction will not add any points to your total points balance'
                                    : 'This transaction will not add any points to your total points balance'
                            }
                        />
                    </span>
                </div>
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
                    {!isConnected ? (
                        'Create or Connect Wallet'
                    ) : isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Pay'
                    )}
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
