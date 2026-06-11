'use client'

import * as Sentry from '@sentry/nextjs'
import Error from 'next/error'
import { useEffect } from 'react'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'

export default function GlobalError({ error }) {
    if (process.env.NODE_ENV !== 'development') {
        useEffect(() => {
            Sentry.captureException(error)
            // Caught chunk errors never reach the inline window-level recovery
            // script — attempt the same guarded one-time reload from here.
            recoverFromChunkError(error)
        }, [error])
    }

    return (
        <html>
            <body>
                <Error />
            </body>
        </html>
    )
}
