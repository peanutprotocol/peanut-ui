import { PEANUT_API_URL, PEANUT_API_KEY } from '@/constants'
import {
    type MantecaDepositResponseData,
    type MantecaWithdrawData,
    type MantecaWithdrawResponse,
    type CreateMantecaOnrampParams,
} from '@/types/manteca.types'
import { fetchWithSentry, jsonStringify } from '@/utils'
import Cookies from 'js-cookie'
import type { Address } from 'viem'
import type { SignUserOperationReturnType } from '@zerodev/sdk/actions'

export interface QrPaymentRequest {
    qrCode: string
    amount?: string
}

export type QrPayment = {
    id: string
    externalId: string
    sessionId: string
    status: string
    currentStage: string
    stages: any[]
    type: 'QR3_PAYMENT' | 'PIX'
    details: {
        depositAddress: Address
        paymentAsset: string
        paymentAgainst: string
        paymentAgainstAmount: string
        paymentAssetAmount: string
        paymentPrice: string
        priceExpireAt: string
        merchant: {
            name: string
        }
    }
    perk?: {
        eligible: boolean
        discountPercentage: number
        claimed?: boolean
        amountSponsored?: number
        txHash?: string
    }
}

export type QrPaymentCharge = {
    uuid: string
    createdAt: string
    link: string
    chainId: string
    tokenAmount: string
    tokenAddress: string
    tokenDecimals: number
    tokenType: string
    tokenSymbol: string
}

export type QrPaymentLock = {
    code: string
    type: string
    companyId: string
    userId: string
    userNumberId: string
    userExternalId: string
    paymentRecipientName: string
    paymentRecipientLegalId: string
    paymentAssetAmount: string
    paymentAsset: string
    paymentPrice: string
    paymentAgainstAmount: string
    paymentAgainst: string
    expireAt: string
    creationTime: string
}

export type QrPaymentResponse =
    | {
          qrPayment: QrPayment
          charge: QrPaymentCharge
      }
    | { paymentLock: QrPaymentLock }

export type MantecaPrice = {
    ticker: string
    buy: string
    sell: string
    timestamp: string
    variation: {
        buy: {
            realtime: string
            daily: string
        }
        sell: {
            realtime: string
            daily: string
        }
    }
    effectiveBuy: string
    effectiveSell: string
}

export const mantecaApi = {
    initiateQrPayment: async (data: QrPaymentRequest): Promise<QrPaymentLock> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/qr-payment/init`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: jsonStringify(data),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `QR payment failed: ${response.statusText}`)
        }

        return response.json()
    },
    /**
     * Complete QR payment with a pre-signed UserOperation.
     * This allows the backend to complete the Manteca payment BEFORE broadcasting the transaction,
     * preventing funds from being stuck in Manteca if their payment fails.
     *
     * Flow:
     * 1. Frontend signs UserOp (funds still in user's wallet)
     * 2. Backend receives signed UserOp
     * 3. Backend completes Manteca payment first
     * 4. If Manteca succeeds, backend broadcasts UserOp
     * 5. If Manteca fails, UserOp is never broadcasted (funds safe)
     */
    completeQrPaymentWithSignedTx: async ({
        paymentLockCode,
        signedUserOp,
        chainId,
        entryPointAddress,
    }: {
        paymentLockCode: string
        signedUserOp: Pick<
            SignUserOperationReturnType,
            | 'sender'
            | 'nonce'
            | 'callData'
            | 'signature'
            | 'callGasLimit'
            | 'verificationGasLimit'
            | 'preVerificationGas'
            | 'maxFeePerGas'
            | 'maxPriorityFeePerGas'
            | 'paymaster'
            | 'paymasterData'
            | 'paymasterVerificationGasLimit'
            | 'paymasterPostOpGasLimit'
            | 'factory'
            | 'factoryData'
        >
        chainId: string
        entryPointAddress: Address
    }): Promise<QrPayment> => {
        const response = await fetchWithSentry(
            `${PEANUT_API_URL}/manteca/qr-payment/complete-with-signed-tx`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
                body: jsonStringify({
                    paymentLockCode,
                    signedUserOp,
                    chainId,
                    entryPointAddress,
                }),
            },
            120000
        )

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData?.message || errorData?.error || `QR payment failed: ${response.statusText}`)
        }

        return response.json()
    },
    claimPerk: async (
        mantecaTransferId: string
    ): Promise<{
        success: boolean
        perk: { sponsored: boolean; amountSponsored: number; discountPercentage: number; txHash?: string }
    }> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/perks/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: jsonStringify({ mantecaTransferId }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Perk claim failed: ${response.statusText}`)
        }

        return response.json()
    },
    getPrices: async ({ asset, against }: { asset: string; against: string }): Promise<MantecaPrice> => {
        // Helper to fetch and parse price data
        const fetchPrice = async (asset: string, against: string): Promise<MantecaPrice> => {
            const response = await fetchWithSentry(
                `${PEANUT_API_URL}/manteca/prices?asset=${asset}&against=${against}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'api-key': PEANUT_API_KEY,
                    },
                }
            )

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `Get prices failed: ${response.statusText}`)
            }

            return response.json()
        }

        // Helper to multiply price fields
        const multiplyPriceFields = (basePrice: MantecaPrice, multiplier: MantecaPrice): MantecaPrice => {
            const multiplyPriceValues = (base: string, mult: string, fieldName: string): string => {
                const baseNum = parseFloat(base)
                const multNum = parseFloat(mult)

                if (!base || !mult || isNaN(baseNum) || isNaN(multNum) || baseNum === 0 || multNum === 0) {
                    throw new Error(`Invalid price values for ${fieldName}: base=${base}, multiplier=${mult}`)
                }

                return (baseNum * multNum).toString()
            }

            return {
                ...basePrice,
                buy: multiplyPriceValues(basePrice.buy, multiplier.buy, 'buy'),
                sell: multiplyPriceValues(basePrice.sell, multiplier.sell, 'sell'),
                effectiveBuy: multiplyPriceValues(basePrice.effectiveBuy, multiplier.effectiveBuy, 'effectiveBuy'),
                effectiveSell: multiplyPriceValues(basePrice.effectiveSell, multiplier.effectiveSell, 'effectiveSell'),
            }
        }

        // Fetch USDC/USDT rate and the requested asset price in parallel
        const [usdtRate, assetPrice] = await Promise.all([fetchPrice('USDC', 'USDT'), fetchPrice(asset, against)])

        // Convert asset price from USDC to USDT equivalent
        return multiplyPriceFields(assetPrice, usdtRate)
    },
    initiateOnboarding: async (params: {
        returnUrl: string
        failureUrl?: string
        exchange?: string
    }): Promise<{ url: string }> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/initiate-onboarding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
            body: jsonStringify(params),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || `Failed to get onboarding URL`)
        }

        return response.json()
    },

    deposit: async (
        params: CreateMantecaOnrampParams
    ): Promise<{ data?: MantecaDepositResponseData; error?: string }> => {
        try {
            const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/deposit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
                body: jsonStringify({
                    usdAmount: params.usdAmount,
                    currency: params.currency,
                    chargeId: params.chargeId,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                console.log('error', response)
                return { error: data.error || 'Failed to create on-ramp transfer for guest.' }
            }

            return { data }
        } catch (error) {
            console.log('error', error)
            console.error('Error calling create manteca on-ramp API:', error)
            if (error instanceof Error) {
                return { error: error.message }
            }
            return { error: 'An unexpected error occurred.' }
        }
    },

    cancelDeposit: async (depositId: string): Promise<{ data?: MantecaDepositResponseData; error?: string }> => {
        try {
            const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/deposit/${depositId}/cancel`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
            })

            const data = await response.json()

            if (!response.ok) {
                console.log('error', response)
                return { error: data.error || 'Failed to cancel manteca deposit.' }
            }

            return { data }
        } catch (error) {
            console.log('error', error)
            console.error('Error calling cancel manteca deposit API:', error)
            if (error instanceof Error) {
                return { error: error.message }
            }
            return { error: 'An unexpected error occurred.' }
        }
    },

    withdraw: async (data: MantecaWithdrawData): Promise<MantecaWithdrawResponse> => {
        try {
            const response = await fetchWithSentry(`${PEANUT_API_URL}/manteca/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                },
                body: jsonStringify(data),
            })

            const result = await response.json()
            if (!response.ok) {
                return { error: result.error || 'Failed to create manteca withdraw.' }
            }

            return { data: result }
        } catch (error) {
            console.log('error', error)
            console.error('Error calling create manteca withdraw API:', error)
            if (error instanceof Error) {
                return { error: error.message }
            }
            return { error: 'An unexpected error occurred.' }
        }
    },
}
