import axios from 'axios'
import * as consts from '@/constants'

export async function checkTransactionStatus(txHash: string): Promise<void> {
    try {
        const response = await axios.get('https://apiplus.squidrouter.com/v2/status', {
            params: { transactionId: txHash },
            headers: { 'x-integrator-id': '11CBA45B-5EE9-4331-B146-48CCD7ED4C7C' },
        })
        return response.data
    } catch (error) {
        console.error('Error fetching transaction status:', error)
        throw error
    }
}

export async function loopUntilSuccess(
    txHash: string,
    setExplorerUrlDestChainWithTxHash: (value: { transactionId: string; transactionUrl: string }) => void
) {
    let intervalId = setInterval(async () => {
        const result = await checkTransactionStatus(txHash)

        //@ts-ignore
        if (result.squidTransactionStatus === 'success') {
            //@ts-ignore
            const explorerUrl = utils.getExplorerUrl(result.toChain.chainData.chainId.toString())
            if (explorerUrl) {
                setExplorerUrlDestChainWithTxHash({
                    //@ts-ignore
                    transactionUrl: explorerUrl + '/tx/' + result.toChain.transactionId,
                    //@ts-ignore
                    transactionId: result.toChain.transactionId,
                })
            } else {
                setExplorerUrlDestChainWithTxHash({
                    //@ts-ignore
                    transactionUrl: result.toChain.transactionUrl,
                    //@ts-ignore
                    transactionId: result.toChain.transactionId,
                })
            }
            clearInterval(intervalId)
        } else {
            console.log('Checking status again...')
        }
    }, 5000)
}

export enum ActionType {
    CLAIM = 'CLAIM',
    FULFILL = 'FULFILL',
}

export const estimatePoints = async ({
    address,
    chainId,
    amountUSD,
    actionType,
}: {
    address: string
    chainId: string
    amountUSD: number
    actionType: ActionType
}) => {
    try {
        const response = await fetch(`${consts.PEANUT_API_URL}/calculate-pts-for-action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
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
            }),
        })
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        return Math.round(data.points)
    } catch (error) {
        console.error('Failed to estimate points:', error)
        return 0
    }
}
