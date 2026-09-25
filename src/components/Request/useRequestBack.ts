import { usePathname } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'
import { useReturnTo } from '@/hooks/useSafeBack'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'

/**
 * Leaves Request for its stated origin (`returnTo`), or home.
 *
 * Request can be re-entered from its own bank-details alternative, so the root
 * exits to its origin rather than one step back. It rewinds to the origin
 * instead of pushing it: a pushed /home kept Request under it, and browser
 * back from home reopened Request (TASK-23054).
 */
export function useRequestBack() {
    const pathname = usePathname()
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const params = { get: (key: string) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }
    return useReturnTo(readReturnTo(params, pathname ?? '/request') ?? '/home')
}
