import peanut, { interfaces as peanutInterfaces } from "@squirrel-labs/peanut-sdk"
import * as _consts from "../Claim.consts";
import * as utils from '@/utils'
import * as _utils from '../Claim.utils'
import * as consts from '@/constants'
import * as interfaces from '@/interfaces'

export type CrossChainDetails = Array<peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }>;

export const getCrossChainDetails = async (linkDetails: interfaces.ILinkDetails): Promise<CrossChainDetails | undefined> => {
    // xchain is only available for native and erc20
    if (linkDetails.tokenType != 0 && linkDetails.tokenType != 1) {
        return undefined
    }

    try {
        const crossChainDetails = await peanut.getXChainOptionsForLink({
            isTestnet: utils.isTestnetChain(linkDetails.chainId.toString()),
            sourceChainId: linkDetails.chainId.toString(),
            tokenType: linkDetails.tokenType,
        })

        const contractVersionCheck = peanut.compareVersions('v4.2', linkDetails.contractVersion, 'v') // v4.2 is the minimum version required for cross chain
        if (crossChainDetails.length > 0 && contractVersionCheck) {
            const xchainDetails = _utils.sortCrossChainDetails(
                crossChainDetails.filter((chain: any) => chain.chainId != '1'),
                consts.supportedPeanutChains,
                linkDetails.chainId
            )
            const filteredXchainDetails = xchainDetails.map((chain) => {
                if (chain.chainId === linkDetails?.chainId) {
                    const filteredTokens = chain.tokens.filter(
                        (token: any) => token.address.toLowerCase() !== linkDetails?.tokenAddress.toLowerCase()
                    )

                    return {
                        ...chain,
                        tokens: filteredTokens,
                    }
                }
                return chain
            })

            return filteredXchainDetails
        } else {
            return undefined
        }
    } catch (error) {
        console.log('error fetching cross chain details: ' + error)
        return undefined
    }
}