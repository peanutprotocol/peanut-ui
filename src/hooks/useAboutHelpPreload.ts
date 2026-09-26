'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { scheduleAboutHelpPreload } from '@/components/Global/appHelpPreload'
import { toHelpLocale } from '@/components/Global/appHelpTypes'

/** Only Profile and About mount this hook; app startup never waits for policy documents. */
export function useAboutHelpPreload() {
    const locale = toHelpLocale(useLocale())
    useEffect(() => scheduleAboutHelpPreload(locale), [locale])
}
