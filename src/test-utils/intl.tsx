import { render as rtlRender, renderHook as rtlRenderHook } from '@testing-library/react'
import type { RenderHookOptions, RenderOptions } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement, ReactNode } from 'react'
import en from '@/i18n/app/messages/en.json'

/**
 * The single intl wrapper for tests, replacing ~33 hand-rolled copies.
 *
 * `timeZone` is pinned to UTC because next-intl otherwise falls back to the
 * runner's system zone, which made date formatting machine-dependent in the two
 * suites that had omitted it.
 *
 * Locale is always `en` — locale-specific rendering is covered by
 * src/i18n/app/__tests__, not by component suites.
 */
export const IntlWrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        {children}
    </NextIntlClientProvider>
)

/** Drop-in for RTL's `render`. Compose extra providers inside `ui`. */
export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
    return rtlRender(ui, { wrapper: IntlWrapper, ...options })
}

/** Drop-in for RTL's `renderHook`. Callable from `.ts` files — no JSX at the
 *  call site, which is why the Sumsub hook suite previously needed a
 *  React.createElement dance plus an eslint-disable. */
export function renderHookWithIntl<Result, Props>(
    callback: (props: Props) => Result,
    options?: Omit<RenderHookOptions<Props>, 'wrapper'>
) {
    return rtlRenderHook(callback, { wrapper: IntlWrapper, ...options })
}
