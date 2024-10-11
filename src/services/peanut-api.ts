import { ActionType } from '@/components/utils/utils'
import { PEANUT_API_URL } from '@/constants'
import { ILinkDetails } from '@/interfaces'
import { getSquidRouteRaw, interfaces } from '@squirrel-labs/peanut-sdk'

export type EstimatePointsArgs = {
    address: string
    chainId: string
    amountUSD: number
    actionType: ActionType
}

export type GetSquidRouteRawArgs = {
    linkDetails: ILinkDetails
    toToken: string
    toChain: string
    toAddress: string
}

export class PeanutAPI {
    baseURL: string = PEANUT_API_URL
    squidRouterUrl: string = 'https://apiplus.squidrouter.com/v2/route'

    getSquidRouteRaw = async ({ linkDetails, toChain, toToken, toAddress }: GetSquidRouteRawArgs) => {
        const { squidRouterUrl } = this
        const {
            chainId: fromChain,
            tokenAddress: fromToken,
            tokenAmount,
            tokenDecimals,
            senderAddress: fromAddress,
        } = linkDetails
        const fromAmount = Math.floor(Number(tokenAmount) * Math.pow(10, tokenDecimals)).toString()
        return getSquidRouteRaw({
            squidRouterUrl,
            fromChain,
            fromToken,
            fromAmount,
            slippage: 1,
            fromAddress,
            toToken,
            toChain,
            toAddress,
        })
    }

    estimatePoints = async (args: EstimatePointsArgs) => {
        const { address, actionType, amountUSD, chainId } = args

        console.log('estimatePoints', { args })

        return this.post('/calculate-pts-for-action', {
            actionType: actionType,
            userAddress: address,
            chainId: chainId,
            amountUsd: amountUSD,
            transaction: {
                from: address,
                to: address,
                data: '',
                value: '',
            },
        })
            .then((res) => {
                return Math.round(res.points)
            })
            .catch(() => {
                return 0
            })
    }

    getAttachmentInfo = async (link: string) => {
        return this.post('/get-attachment-info', {
            link,
        })
            .then(({ fileUrl, message }) => {
                return {
                    fileUrl,
                    message,
                }
            })
            .catch(() => {
                return undefined
            })
    }

    post = async (url: string, body: any) => {
        return fetch(this.baseURL + url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }).then((res) => {
            if (!res.ok) {
                throw new Error('HTTP error! status: ' + res.status)
            }
            return res.json()
        })
    }
}
