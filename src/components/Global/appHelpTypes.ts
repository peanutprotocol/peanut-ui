import type { ReactNode } from 'react'

export const APP_HELP_SLUGS = [
    'verification',
    'transaction-limits',
    'request-money',
    'card-collateral',
    'passkeys',
    'security-disclosure',
] as const
export type AppHelpSlug = (typeof APP_HELP_SLUGS)[number]
export type HelpLocale = 'en' | 'es-419' | 'es-ar' | 'pt-br'
export type HelpDocument = { title: string; content: ReactNode }
export type AppHelpDocuments = Record<AppHelpSlug, Record<HelpLocale, HelpDocument>>

export const isAppHelpSlug = (slug: string): slug is AppHelpSlug =>
    APP_HELP_SLUGS.some((supported) => supported === slug)
