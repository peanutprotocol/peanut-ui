'use client'

import { useEffect, useState } from 'react'

/**
 * TEMPORARY (TASK-25063, signup v7): the helper-line pattern on Residence and Payment plan, picked by `?infoline=a|b|c`
 * so the three options can be compared on a device. a = one helper line at most, b = no inline lines (a "why" sheet
 * holds them), c = one merged line. Delete this hook and the losing options once Kush picks one.
 */
export type InfoLineOption = 'a' | 'b' | 'c'

export function useInfoLineOption(): InfoLineOption {
    const [option, setOption] = useState<InfoLineOption>('a')
    // read after mount: the static export prerenders without the query string
    useEffect(() => {
        const value = new URLSearchParams(window.location.search).get('infoline')
        if (value === 'b' || value === 'c') setOption(value)
    }, [])
    return option
}
