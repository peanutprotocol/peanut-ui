import * as consts from '@/constants'
import * as utils from '@/utils'
import { fetchWithSentry } from '@/utils'
import * as Sentry from '@sentry/nextjs'

type ISquidChainData = {
    id: string
    chainId: string
    networkIdentifier: string
    chainName: string
    axelarChainName: string
    type: string
    networkName: string
    nativeCurrency: {
        name: string
        symbol: string
        decimals: number
        icon: string
    }
    chainIconURI: string
    blockExplorerUrls: string[]
    swapAmountForGas: string
    sameChainSwapsSupported: boolean
    compliance: {
        trmIdentifier: string
    }
    boostSupported: boolean
    enableBoostByDefault: boolean
    rpcList: string[]
    chainNativeContracts: {
        wrappedNativeToken: string
        ensRegistry: string
        multicall: string
        usdcToken: string
    }
    feeCurrencies: any[]
    currencies: any[]
    features: any[]
}

type ISquidStatusResponse = {
    id: string
    status: string
    gasStatus: string
    isGMPTransaction: boolean
    axelarTransactionUrl: string
    fromChain: {
        transactionId: string
        blockNumber: number
        callEventStatus: string
        callEventLog: any[]
        chainData: ISquidChainData
        transactionUrl: string
    }
    toChain: {
        transactionId: string
        blockNumber: number
        callEventStatus: string
        callEventLog: any[]
        chainData: ISquidChainData
        transactionUrl: string
    }
    timeSpent: {
        call_express_executed: number
        total: number
    }
    routeStatus: any[]
    error: any
    squidTransactionStatus: string
}

export async function checkTransactionStatus(txHash: string): Promise<ISquidStatusResponse> {
    try {
        const response = await fetchWithSentry(`https://apiplus.squidrouter.com/v2/status?transactionId=${txHash}`, {
            headers: { 'x-integrator-id': '11CBA45B-5EE9-4331-B146-48CCD7ED4C7C' }, // TODO: request v2 removes checking squid status
        })
        const data = await response.json()
        return data
    } catch (error) {
        console.warn('Error fetching transaction status:', error)
        throw error
    }
}

export async function fetchDestinationChain(
    txHash: string,
    setExplorerUrlDestChainWithTxHash: (value: { transactionId: string; transactionUrl: string }) => void
) {
    let intervalId = setInterval(async () => {
        const result = await checkTransactionStatus(txHash)

        if (result.squidTransactionStatus === 'success') {
            const explorerUrl = utils.getExplorerUrl(result.toChain.chainData.chainId.toString())
            if (explorerUrl) {
                setExplorerUrlDestChainWithTxHash({
                    transactionUrl: explorerUrl + '/tx/' + result.toChain.transactionId,
                    transactionId: result.toChain.transactionId,
                })
            } else {
                setExplorerUrlDestChainWithTxHash({
                    transactionUrl: result.toChain.transactionUrl,
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
        const response = await fetchWithSentry(`${consts.PEANUT_API_URL}/calculate-pts-for-action`, {
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
        Sentry.captureException(error)
        console.error('Failed to estimate points:', error)
        return 0
    }
}
