import { useEffect, useId } from 'react'

export function useAmountErrorScroll(error: string | null | undefined) {
    const id = useId()
    const errorId = `${id}-error`

    useEffect(() => {
        if (!error) return
        const input = document.getElementById(id)?.querySelector('input')
        if (input && document.activeElement === input) {
            document.getElementById(errorId)?.scrollIntoView?.({ block: 'nearest' })
        }
    }, [error, id, errorId])

    return { id, errorId }
}
