'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/Global/Loading'
import { useAuth } from '@/context/authContext'
import { withdrawEntryForLink } from '../link-destination'

interface SignedInEvmLinkRedirectProps {
    /** The link's path segments: an EVM address or ENS name, then its chain and amount. */
    recipient: string[]
    /** The payment page, which guests and every link the withdrawal refuses keep. */
    children: ReactNode
}

/**
 * A signed-in visit to a payment link for an EVM address or ENS name is the
 * user's own payout, so it goes into the crypto withdrawal, as a scan of one
 * does (TASK-23974). Guests keep the payment page.
 *
 * The payment page comes in as children so the native send router can keep
 * loading it lazily.
 */
export function SignedInEvmLinkRedirect({ recipient, children }: SignedInEvmLinkRedirectProps) {
    const router = useRouter()
    const { user, isFetchingUser } = useAuth()
    const isLoggedIn = !!user?.user?.userId
    // Next can hand over a new array for the same route.
    const recipientKey = JSON.stringify(recipient)
    const [refusedKey, setRefusedKey] = useState<string | null>(null)

    useEffect(() => {
        if (!isLoggedIn) return
        let cancelled = false
        withdrawEntryForLink(JSON.parse(recipientKey))
            .catch(() => null)
            .then((entryUrl) => {
                if (cancelled) return
                // replace, so back goes to where the user came from
                if (entryUrl) router.replace(entryUrl)
                else setRefusedKey(recipientKey)
            })
        return () => {
            cancelled = true
        }
    }, [isLoggedIn, recipientKey, router])

    // Until the session is known, show neither page: a signed-in user must not
    // see the payment page flash before the redirect.
    if (!isLoggedIn) return isFetchingUser ? <Loading variant="mascot" /> : <>{children}</>
    if (refusedKey === recipientKey) return <>{children}</>
    return <Loading variant="mascot" />
}
