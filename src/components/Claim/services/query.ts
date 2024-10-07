import peanut from '@squirrel-labs/peanut-sdk'
import * as _consts from '../Claim.consts'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import { PeanutAPI } from '@/services/peanut-api'
import { CrossChainDetails, getCrossChainDetails } from './cross-chain'
import { FetchQueryOptions } from '@tanstack/react-query'
import { CheckLinkReturnType } from '../types'

export const fetchClaim = async (link: string) => {
    let linkState: _consts.claimLinkState = 'ALREADY_CLAIMED'
    let crossChainDetails: CrossChainDetails | undefined = undefined
    let tokenPrice: number = 0
    let estimatedPoints: number = 0
    let recipient: { name: string | undefined; address: string } = { name: undefined, address: '' }

    const linkDetails: interfaces.ILinkDetails = await peanut.getLinkDetails({
        link,
    })
    const attachmentInfo = await new PeanutAPI().getAttachmentInfo(linkDetails.link)

    if (linkDetails.claimed) {
        linkState = 'ALREADY_CLAIMED'
    } else {
        crossChainDetails = await getCrossChainDetails(linkDetails)
        tokenPrice =
            (await utils.fetchTokenPrice(linkDetails.tokenAddress.toLowerCase(), linkDetails.chainId))?.price ?? 0

        // NOTE: Let client estimate points
        // estimatedPoints = await estimatePoints({
        //     address: address ?? '',
        //     chainId: linkDetails.chainId,
        //     amountUSD: Number(linkDetails.tokenAmount) * tokenPrice,
        //     actionType: ActionType.CLAIM,
        // })

        linkState = 'CLAIM'
    }
    return {
        linkDetails,
        attachmentInfo: {
            message: attachmentInfo?.message,
            attachmentUrl: attachmentInfo?.fileUrl,
        },
        crossChainDetails,
        tokenPrice,
        estimatedPoints,
        recipient,
        linkState,
    }
}

export const getClaimQuery = (link: string): FetchQueryOptions<CheckLinkReturnType> => {
    const params = new URLSearchParams(link.split('?')[1]).toString()

    return {
        queryKey: ['claiming-', params],
        queryFn: ({ queryKey }) => {
            console.log('queryKey: ', queryKey)
            const searchParams = queryKey[1]
            const link = `https://peanut.to/claim?${searchParams}`
            return fetchClaim(link)
        },
    }
}
