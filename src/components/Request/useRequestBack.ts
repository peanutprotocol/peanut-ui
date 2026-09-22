import { usePathname, useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'

export function useRequestBack(options: { replace?: boolean } = {}) {
    const router = useRouter()
    const pathname = usePathname()
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)

    // Request can be re-entered from its own bank-details alternative. History
    // can lead back into that loop, so the root exits to its stated origin.
    return () => {
        const params = { get: (key: string) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }
        const destination = readReturnTo(params, pathname ?? '/request') ?? '/home'
        if (options.replace) router.replace(destination)
        else router.push(destination)
    }
}
