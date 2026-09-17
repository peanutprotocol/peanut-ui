import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { readReturnTo } from '@/utils/return-to.utils'

export function useRequestBack() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Request can be re-entered from its own bank-details alternative. History
    // can lead back into that loop, so the root exits to its stated origin.
    return () => router.push(readReturnTo(searchParams, pathname ?? '/request') ?? '/home')
}
