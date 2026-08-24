import { apiFetch } from '@/utils/api-fetch'
import { printableUsdc } from '@/utils/balance.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { AccountType, type IUserProfile } from '@/interfaces/interfaces'
import type { Address } from 'viem'

/**
 * Where the exchange-rate widget's CTA sends a signed-in visitor.
 *
 * Imported at click time, not at render: resolving it needs the user and their
 * balance, and reaching for those through `useAuth` was the only thing keeping
 * AuthProvider — and behind it react-query and the redux store — mounted on the
 * marketing site. Nobody who never clicks the CTA should pay for that.
 *
 * Falls back to signup whenever the session or the balance can't be read, which
 * is also the safe destination: add-money is where a zero balance would land.
 */
export async function resolveExchangeCtaRoute(sourceCurrency: string, destinationCurrency: string): Promise<string> {
    try {
        const response = await apiFetch('/users/me', { method: 'GET' })
        if (!response.ok) return '/setup'

        const user = (await response.json()) as IUserProfile | null
        const address = user?.accounts?.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier
        if (!address) return '/setup'

        let balance = 0
        try {
            const { smartUsdcBalanceQueryOptions } = await import('@/hooks/wallet/useBalance')
            balance = parseFloat(printableUsdc(await smartUsdcBalanceQueryOptions(address as Address).queryFn()))
        } catch {
            // unreadable balance reads as zero, which routes to add-money
        }

        return getExchangeRateWidgetRedirectRoute(sourceCurrency, destinationCurrency, balance)
    } catch {
        return '/setup'
    }
}
