'use client'

import { useContext } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { AppLocaleContext } from '@/i18n/app/locale-context'
import { currentAppLocale } from '@/i18n/app/locale-store'
import { EurcMoneyFormFields } from './EurcMoneyFormFields'
import type { CurrencyMoneyFormProps } from './currency-account.types'

export function EurcMoneyFormView(props: CurrencyMoneyFormProps) {
    const locale = useContext(AppLocaleContext)?.locale ?? currentAppLocale() ?? 'en'
    return (
        <NextIntlClientProvider locale={locale}>
            <EurcMoneyFormFields {...props} />
        </NextIntlClientProvider>
    )
}
