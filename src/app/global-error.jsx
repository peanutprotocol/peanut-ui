'use client'

import * as Sentry from '@sentry/nextjs'
import Error from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({ error }) {
    if (process.env.NODE_ENV !== 'development') {
        useEffect(() => {
            Sentry.captureException(error)
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
