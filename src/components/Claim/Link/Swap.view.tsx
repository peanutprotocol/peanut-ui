import TokenSelector from '@/components/Global/TokenSelector'

import * as consts from '@/constants'
import * as _consts from '../Claim.consts'
import * as interfaces from '@/interfaces'
import * as context from '@/context'
import { AdvancedTokenSelectorButton } from '@/components/Global/TokenSelector/AdvancedButton'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useContext, useEffect } from 'react'
import Icon from '@/components/Global/Icon'

interface xchainDetail {
    axelarChainName?: string
    chainIconURI?: string
    chainId?: string
    chainType?: string
}

type SquidChainWithTokens = peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }

interface CombinedType extends interfaces.IPeanutChainDetails {
    tokens: interfaces.IToken[]
} // TODO: move to interfaces

function mapToIPeanutChainDetailsArray(data: SquidChainWithTokens[] | undefined): CombinedType[] {
    if (!data) return []

    const combinedArray: CombinedType[] = []
    data.forEach((chain) => {
        const chainDetails: interfaces.IPeanutChainDetails = {
            name: chain.axelarChainName || '',
            chain: chain.chainType || '',
            icon: {
                url: chain.chainIconURI || '',
                format: '',
            },
            rpc: [],
            features: [],
            faucets: [],
            nativeCurrency: {
                name: '',
                symbol: '',
                decimals: 0,
            },
            infoURL: '',
            shortName: '',
            chainId: chain.chainId || '',
            networkId: 0,
            slip44: 0,
            ens: {
                registry: '',
            },
            explorers: [],
            mainnet: false,
        }

        const combinedObject: CombinedType = {
            ...chainDetails,
            tokens: [],
        }

        if (chain.tokens && chain.tokens.length > 0) {
            chain.tokens.forEach((token) => {
                combinedObject.tokens.push({
                    address: token.address || '',
                    name: token.name || '',
                    symbol: token.symbol || '',
                    decimals: 0,
                    logoURI: token.logoURI || '',
                    chainId: chain.chainId || '',
                })
            })
        }

        combinedArray.push(combinedObject) // Pushing the combined object for the chain
    })

    return combinedArray
}

export const SwapInitialClaimLinkView = ({
    onNext,
    onPrev,
    claimLinkData,
    tokenPrice,
    crossChainDetails,
}: _consts.IClaimScreenProps) => {
    const { selectedChainID, selectedTokenAddress, setSelectedChainID } = useContext(context.tokenSelectorContext)

    const sourceToken = consts.peanutTokenDetails
        .find((detail) => detail.chainId === claimLinkData.chainId)
        ?.tokens.find((token) => token.address === claimLinkData.tokenAddress)
    const sourceChain = consts.supportedPeanutChains.find((detail) => detail.chainId === claimLinkData.chainId)
    const mappedData: CombinedType[] = mapToIPeanutChainDetailsArray(crossChainDetails)

    useEffect(() => {
        console.log('fetching route')
    }, [selectedTokenAddress])

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">You're swapping</label>

            <label className="max-w-96 px-2 text-start text-h8 font-light">
                Choose the destination chain and token. You’ll be able to claim the funds in any token on any chain.
            </label>

            <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                <label className="text-h7 font-normal">From</label>
                <AdvancedTokenSelectorButton
                    onClick={() => {}}
                    isVisible={false}
                    tokenLogoUri={sourceToken?.logoURI ?? ''}
                    tokenSymbol={sourceToken?.symbol ?? ''}
                    tokenAmount={claimLinkData.tokenAmount}
                    tokenPrice={tokenPrice}
                    chainIconUri={sourceChain?.icon.url ?? ''}
                    chainName={sourceChain?.name ?? ''}
                    isStatic
                    type="xchain"
                />
            </div>
            <div className="flex w-full flex-col items-start justify-center gap-3 px-2">
                <label className="text-h7 font-normal">To</label>
                <TokenSelector data={mappedData} type="xchain" xchainTokenAmount="100" xchainTokenPrice={1} />
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Fees</label>
                    </div>
                    <label className="font-normal">$0.00</label>
                </div>

                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <label className="font-normal">+300</label>
                </div>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button className="btn-purple btn-xl" onClick={onNext}>
                    Swap
                </button>
                <button className="btn btn-xl dark:border-white dark:text-white" onClick={onPrev}>
                    Return
                </button>
            </div>
        </div>
    )
}

export default SwapInitialClaimLinkView
