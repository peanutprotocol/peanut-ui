'use client'
import { useTranslationMutationHandler } from '@/hooks/useTranslationMutationHandler'

// patches dom methods globally to prevent translation extension crashes
export const TranslationSafeWrapper = ({ children }: { children: React.ReactNode }) => {
    useTranslationMutationHandler()
    return <>{children}</>
}
