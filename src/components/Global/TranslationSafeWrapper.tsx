'use client'
import { useTranslationMutationHandler } from '@/hooks/useTranslationMutationHandler'
import { useRef } from 'react'

// wraps the app to handle google translate dom mutations globally
// prevents "Failed to execute 'insertBefore' on 'Node'" errors
// while still allowing translations to work properly
export const TranslationSafeWrapper = ({ children }: { children: React.ReactNode }) => {
    const wrapperRef = useRef<HTMLDivElement>(null)
    // attach mutation observer to handle translation service dom changes
    useTranslationMutationHandler(wrapperRef)

    return (
        <div ref={wrapperRef} className="contents">
            {children}
        </div>
    )
}
