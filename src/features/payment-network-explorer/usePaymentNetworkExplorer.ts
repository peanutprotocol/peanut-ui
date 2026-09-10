'use client'

import { useEffect, useState } from 'react'
import { fetchPaymentNetwork, PaymentNetworkApiError } from './api'
import type { ExplorerGraphResponse } from './types'

export type ExplorerLoadStatus = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error'

export interface PaymentNetworkExplorerState {
    data: ExplorerGraphResponse | null
    status: ExplorerLoadStatus
    error: PaymentNetworkApiError | null
    reload: () => void
}

export interface ExplorerRequest {
    topNodes: number
}

export function usePaymentNetworkExplorer(request: ExplorerRequest | null): PaymentNetworkExplorerState {
    const [data, setData] = useState<ExplorerGraphResponse | null>(null)
    const [status, setStatus] = useState<ExplorerLoadStatus>('idle')
    const [error, setError] = useState<PaymentNetworkApiError | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const topNodes = request?.topNodes ?? null

    useEffect(() => {
        if (topNodes === null) {
            setData(null)
            setStatus('idle')
            return
        }
        let active = true

        const load = async () => {
            setData(null)
            setError(null)
            setStatus('loading')
            try {
                const next = await fetchPaymentNetwork(topNodes)
                if (!active) return
                setData(next)
                setStatus('ready')
            } catch (loadError) {
                if (!active) return
                const apiError =
                    loadError instanceof PaymentNetworkApiError
                        ? loadError
                        : new PaymentNetworkApiError('The live payment network is unavailable. Try again.', 503)
                setError(apiError)
                setStatus(apiError.status === 403 ? 'forbidden' : 'error')
            }
        }

        void load()
        return () => {
            active = false
        }
    }, [topNodes, reloadKey])

    return {
        data,
        status,
        error,
        reload: () => setReloadKey((value) => value + 1),
    }
}
