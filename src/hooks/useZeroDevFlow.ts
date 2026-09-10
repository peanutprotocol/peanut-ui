'use client'

import { useSyncExternalStore } from 'react'

/**
 * ZeroDev flow flags + kernel address (TASK-21462 — was the redux `zeroDev`
 * slice). One app-global value with writers on both sides of the provider
 * tree: authContext resets it on logout (above KernelClientProvider, so a
 * context hook would be a cycle), kernelClient.context writes it as clients
 * build, useZeroDev writes it around register/login/send. A module-level
 * external store keeps the singleton semantics the slice had, without the
 * store, the Provider, or the provider-order coupling.
 */
interface ZeroDevFlowState {
    isKernelClientReady: boolean
    isRegistering: boolean
    isLoggingIn: boolean
    isSendingUserOp: boolean
    address?: string
}

const initialState: ZeroDevFlowState = {
    isKernelClientReady: false,
    isRegistering: false,
    isLoggingIn: false,
    isSendingUserOp: false,
    address: undefined,
}

let state: ZeroDevFlowState = initialState
const listeners = new Set<() => void>()

function write(patch: Partial<ZeroDevFlowState>): void {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function useZeroDevFlow(): ZeroDevFlowState {
    return useSyncExternalStore(
        subscribe,
        () => state,
        () => initialState
    )
}

/** Imperative writers — callable from effects, handlers, and non-hook code. */
export const zeroDevFlowActions = {
    setIsKernelClientReady: (value: boolean) => write({ isKernelClientReady: value }),
    setIsRegistering: (value: boolean) => write({ isRegistering: value }),
    setIsLoggingIn: (value: boolean) => write({ isLoggingIn: value }),
    setIsSendingUserOp: (value: boolean) => write({ isSendingUserOp: value }),
    setAddress: (value: string | undefined) => write({ address: value }),
    /** logout / pre-registration wipe — back to the initial flags AND no address */
    reset: () => {
        state = initialState
        listeners.forEach((listener) => listener())
    },
}
