'use client'

import { useSyncExternalStore } from 'react'

/** Same query as `.signup-shell` and the `signup-sm:` variant in globals.css: the mock's 320x568 check phone. */
export const SIGNUP_SM_QUERY = '(max-height: 600px), (max-width: 340px)'

export type ShellDevice = 'std' | 'sm'

const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(SIGNUP_SM_QUERY)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
}

/** 'sm' on a small phone, where the mock lays some screens out differently (art hidden, stage compact). */
export function useShellDevice(): ShellDevice {
    return useSyncExternalStore(
        subscribe,
        () => (window.matchMedia(SIGNUP_SM_QUERY).matches ? 'sm' : 'std'),
        () => 'std'
    )
}
