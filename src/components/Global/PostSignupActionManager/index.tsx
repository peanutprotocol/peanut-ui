'use client'

import { clearRedirectUrl, getStoredRedirect } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AskShell } from '@/features/attention/AskShell'
import { POST_SIGNUP_ACTIONS } from './post-signup-action.consts'
import type { AskSurfaceProps } from '@/features/attention/types'

/**
 * "Verification complete, finish what you came for": the stored post-auth
 * redirect (a claim link, a request link) the user was sent to sign up from.
 * Whether it shows is the attention manager's call (the
 * `post-verification-action` ask); this reads the redirect once on mount so
 * the modal survives the redirect being cleared mid-flow.
 */
export default function PostSignupActionManager({ onActed, onDismissed, presentation }: AskSurfaceProps) {
    const router = useRouter()
    const [snapshot] = useState(() => {
        const redirect = getStoredRedirect()
        const action = redirect && POST_SIGNUP_ACTIONS.find((a) => a.pathPattern.test(redirect.destination))
        return redirect && action ? { redirect, config: action.config } : null
    })

    if (!snapshot) return null
    const { redirect, config } = snapshot

    return (
        <AskShell
            presentation={presentation}
            visible
            onClose={() => {
                clearRedirectUrl(redirect)
                onDismissed()
            }}
            preventClose // Prevent closing the modal by clicking outside
            title={config.title}
            description={config.description}
            tone="success"
            icon={config.icon}
            ctas={[
                {
                    text: config.cta,
                    onClick: () => {
                        router.push(redirect.destination)
                        clearRedirectUrl(redirect)
                        onActed()
                    },
                    variant: 'primary',
                    shadowSize: '4',
                },
            ]}
        />
    )
}

export { PostSignupActionManager }
