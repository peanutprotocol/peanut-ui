'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Loading from '@/components/Global/Loading'

/** Routing alias for /profile/accounts-and-payments/additional. See ../page.tsx. */
export default function AdditionalVerificationAlias() {
    const router = useRouter()
    useEffect(() => {
        router.replace(`/profile/accounts-and-payments/additional${window.location.search}`)
    }, [router])
    // A page-level wait, so the page loader, centred — not the 16px inline spinner.
    return (
        <PageStack>
            <PageStack.Center>
                <Loading variant="mascot" />
            </PageStack.Center>
        </PageStack>
    )
}
