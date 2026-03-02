'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="mt-2 max-w-md text-gray-600">
                We had trouble loading this page. Please try again or go back to the homepage.
            </p>
            <div className="mt-6 flex gap-3">
                <button
                    onClick={reset}
                    className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                    Try again
                </button>
                <Link
                    href="/"
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                    Go home
                </Link>
            </div>
        </div>
    )
}
