import { ActionType } from '@/components/utils/utils'
import { PEANUT_API_URL } from '@/constants'

export type EstimatePointsArgs = {
    address: string
    chainId: string
    amountUSD: number
    actionType: ActionType
}

export class PeanutAPI {
    baseURL: string = PEANUT_API_URL

    estimatePoints = async ({ address, actionType, amountUSD, chainId }: EstimatePointsArgs) => {
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
