'use client'

// hook for managing charge lifecycle (create, fetch, cache)
// extracted from usePaymentInitiator for single responsibility

import { useState, useCallback } from 'react'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { type TRequestChargeResponse, type TCharge, type TChargeTransactionType } from '@/services/services.types'
import { isNativeCurrency } from '@/utils/general.utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { type Address } from 'viem'

// params for creating a new charge
export interface CreateChargeParams {
    tokenAmount: string
    tokenAddress: Address
    chainId: string
    tokenSymbol: string
    tokenDecimals: number
    recipientAddress: Address
    transactionType?: TChargeTransactionType
    requestId?: string
    reference?: string
    attachment?: File
    currencyAmount?: string
    currencyCode?: string
}

// return type for the hook
export interface UseChargeManagerReturn {
    charge: TRequestChargeResponse | null
    isCreating: boolean
    isFetching: boolean
    error: string | null
    createCharge: (params: CreateChargeParams) => Promise<TRequestChargeResponse>
    fetchCharge: (chargeId: string) => Promise<TRequestChargeResponse>
    setCharge: (charge: TRequestChargeResponse | null) => void
    reset: () => void
}

export const useChargeManager = (): UseChargeManagerReturn => {
    const [charge, setCharge] = useState<TRequestChargeResponse | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // fetch existing charge by id
    const fetchCharge = useCallback(async (chargeId: string): Promise<TRequestChargeResponse> => {
        setIsFetching(true)
        setError(null)

        try {
            const chargeDetails = await chargesApi.get(chargeId)
            setCharge(chargeDetails)
            return chargeDetails
        } catch (err) {
            const message = err instanceof Error ? err.message : 'failed to fetch charge'
            setError(message)
            throw err
        } finally {
            setIsFetching(false)
        }
    }, [])

    // create a new charge
    const createCharge = useCallback(async (params: CreateChargeParams): Promise<TRequestChargeResponse> => {
        setIsCreating(true)
        setError(null)

        try {
            // if requestId provided, validate it exists
            let validRequestId = params.requestId
            if (params.requestId) {
                try {
                    const request = await requestsApi.get(params.requestId)
                    validRequestId = request.uuid
                } catch {
                    throw new Error('invalid request id')
                }
            }

            // build the create charge payload
            const localPrice =
                params.currencyAmount && params.currencyCode
                    ? { amount: params.currencyAmount, currency: params.currencyCode }
                    : { amount: params.tokenAmount, currency: 'USD' }

            const createPayload: {
                pricing_type: 'fixed_price'
                local_price: { amount: string; currency: string }
                baseUrl: string
                requestId?: string
                requestProps: {
                    chainId: string
                    tokenAmount: string
                    tokenAddress: Address
                    tokenType: peanutInterfaces.EPeanutLinkType
                    tokenSymbol: string
                    tokenDecimals: number
                    recipientAddress: Address
                }
                transactionType?: TChargeTransactionType
                attachment?: File
                reference?: string
                mimeType?: string
                filename?: string
            } = {
                pricing_type: 'fixed_price',
                local_price: localPrice,
                baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
                requestProps: {
                    chainId: params.chainId,
                    tokenAmount: params.tokenAmount,
                    tokenAddress: params.tokenAddress,
                    tokenType: isNativeCurrency(params.tokenAddress)
                        ? peanutInterfaces.EPeanutLinkType.native
                        : peanutInterfaces.EPeanutLinkType.erc20,
                    tokenSymbol: params.tokenSymbol,
                    tokenDecimals: params.tokenDecimals,
                    recipientAddress: params.recipientAddress,
                },
                transactionType: params.transactionType,
            }

            // add request id if provided
            if (validRequestId) {
                createPayload.requestId = validRequestId
            }

            // add attachment if present
            if (params.attachment) {
                createPayload.attachment = params.attachment
                createPayload.filename = params.attachment.name
                createPayload.mimeType = params.attachment.type
            }

            // add reference/message if present
            if (params.reference) {
                createPayload.reference = params.reference
            }

            // create the charge
            const chargeResponse: TCharge = await chargesApi.create(createPayload)

            if (!chargeResponse.data.id) {
                throw new Error('charge created but missing uuid')
            }

            // fetch full charge details
            const chargeDetails = await chargesApi.get(chargeResponse.data.id)
            setCharge(chargeDetails)

            return chargeDetails
        } catch (err) {
            const message = err instanceof Error ? err.message : 'failed to create charge'
            setError(message)
            throw err
        } finally {
            setIsCreating(false)
        }
    }, [])

    // reset all state
    const reset = useCallback(() => {
        setCharge(null)
        setIsCreating(false)
        setIsFetching(false)
        setError(null)
    }, [])

    return {
        charge,
        isCreating,
        isFetching,
        error,
        createCharge,
        fetchCharge,
        setCharge,
        reset,
    }
}
