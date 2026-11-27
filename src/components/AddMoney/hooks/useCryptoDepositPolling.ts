'use client'

import { rhinoApi } from '@/services/rhino'
import type { DepositAddressStatusResponse } from '@/services/services.types'
import { forgetCryptoDepositsAt } from '@/features/add-money/captureCryptoDepositCompleted'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

const POLLING_DELAY = 15_000

type DepositStatus = 'not_started' | 'loading' | 'failed' | 'completed'

export function useCryptoDepositPolling(
    depositAddress: string | undefined,
    onSuccess: (amount: number, statusData?: DepositAddressStatusResponse) => void,
    /** The charge a request-payment address was opened for; needed to clear its status. */
    chargeId?: string,
    /**
     * Read the status at once instead of after the delay: a caller that opens on an address the user
     * may already have sent to must see a deposit in flight before it shows the address again.
     */
    { readNow = false }: { readNow?: boolean } = {}
) {
    const [isDelayComplete, setIsDelayComplete] = useState(readNow)
    const [isResetting, setIsResetting] = useState(false)
    const hasCalledSuccess = useRef(false)
    const isResettingRef = useRef(false)
    const queryClient = useQueryClient()

    useEffect(() => {
        if (readNow) return
        const timer = setTimeout(() => setIsDelayComplete(true), POLLING_DELAY)
        return () => clearTimeout(timer)
    }, [readNow])

    const queryKey = useMemo(() => ['rhino-deposit-address-status', depositAddress], [depositAddress])

    // after a clear the status reads "not started" at once, but that answer is ours, not the API's: it
    // counts as read only once a real answer lands after it (`dataUpdatedAt` past this mark)
    const [syntheticAt, setSyntheticAt] = useState<number | null>(null)

    const {
        data: statusData,
        dataUpdatedAt,
        isError,
        refetch,
    } = useQuery({
        queryKey,
        queryFn: () => {
            if (!depositAddress) {
                throw new Error('Deposit address is required')
            }
            return rhinoApi.getDepositAddressStatus(depositAddress)
        },
        enabled: !!depositAddress && isDelayComplete,
        gcTime: 0, // don't cache across navigations — prevents stale success state
        refetchInterval: (query: { state: { data?: { status?: string } } }) => {
            const s = query.state.data?.status
            return s === 'completed' || s === 'failed' ? false : 5000
        },
    })

    const status: DepositStatus = useMemo(() => {
        if (statusData?.status === 'accepted' || statusData?.status === 'pending') {
            return 'loading'
        } else if (statusData?.status === 'failed') {
            return 'failed'
        } else if (statusData?.status === 'completed') {
            return 'completed'
        }
        return 'not_started'
    }, [statusData])

    useEffect(() => {
        if (status === 'completed' && statusData?.amount && !hasCalledSuccess.current) {
            hasCalledSuccess.current = true
            onSuccess(statusData.amount, statusData)
        }
    }, [statusData, status, onSuccess])

    const resetStatus = useCallback(async () => {
        if (isResettingRef.current || !depositAddress) return
        isResettingRef.current = true
        setIsResetting(true)
        try {
            await rhinoApi.resetDepositAddressStatus(depositAddress, chargeId)
            await queryClient.cancelQueries({ queryKey })
            hasCalledSuccess.current = false
            queryClient.setQueryData<DepositAddressStatusResponse>(queryKey, { status: 'not_started' })
            setSyntheticAt(queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? Date.now())
            forgetCryptoDepositsAt(depositAddress)
            await queryClient.invalidateQueries({ queryKey })
        } catch (error) {
            console.error('Failed to reset deposit status:', error)
            throw error
        } finally {
            isResettingRef.current = false
            setIsResetting(false)
        }
    }, [depositAddress, chargeId, queryKey, queryClient])

    const synthetic = syntheticAt !== null && dataUpdatedAt <= syntheticAt
    /**
     * `isStatusRead`: the API answered with a status, so `status` is not a guess. Until then (no answer
     * yet, or only the "not started" a clear wrote) a failed read (`statusError`) is unknown, never "not
     * started": a deposit may be on its way. The poll keeps reading; `refetchStatus` reads again at once.
     */
    return {
        status,
        resetStatus,
        isResetting,
        isStatusRead: statusData !== undefined && !synthetic,
        statusError: isError && (statusData === undefined || synthetic),
        /** the latest read failed, so even a known status may be out of date (the poll keeps trying) */
        statusFailing: isError,
        refetchStatus: refetch,
    }
}
