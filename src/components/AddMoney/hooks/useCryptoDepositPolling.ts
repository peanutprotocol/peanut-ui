'use client'

import { rhinoApi } from '@/services/rhino'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

const POLLING_DELAY = 15_000

type DepositStatus = 'not_started' | 'loading' | 'failed' | 'completed'

export function useCryptoDepositPolling(depositAddress: string | undefined, onSuccess: (amount: number) => void) {
    const [isDelayComplete, setIsDelayComplete] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const hasCalledSuccess = useRef(false)
    const isResettingRef = useRef(false)
    const queryClient = useQueryClient()

    useEffect(() => {
        const timer = setTimeout(() => setIsDelayComplete(true), POLLING_DELAY)
        return () => clearTimeout(timer)
    }, [])

    const queryKey = useMemo(() => ['rhino-deposit-address-status', depositAddress], [depositAddress])

    const { data: statusData } = useQuery({
        queryKey,
        queryFn: () => {
            if (!depositAddress) {
                throw new Error('Deposit address is required')
            }
            return rhinoApi.getDepositAddressStatus(depositAddress)
        },
        enabled: !!depositAddress && isDelayComplete,
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
            onSuccess(statusData.amount)
        }
    }, [statusData, status, onSuccess])

    const resetStatus = useCallback(async () => {
        if (isResettingRef.current || !depositAddress) return
        isResettingRef.current = true
        setIsResetting(true)
        try {
            await rhinoApi.resetDepositAddressStatus(depositAddress)
            hasCalledSuccess.current = false
            await queryClient.invalidateQueries({ queryKey })
        } catch (error) {
            console.error('Failed to reset deposit status:', error)
            throw error
        } finally {
            isResettingRef.current = false
            setIsResetting(false)
        }
    }, [depositAddress, queryKey, queryClient])

    return { status, resetStatus, isResetting }
}
