import { redirect } from 'next/navigation'

/**
 * The Accounts & payments screen moved here from /profile/identity-verification
 * (2026-09-19, ui#3271 QA follow-ups) — the visible title had read "Accounts
 * and payments" since the currency-first merge, but the URL segment stayed
 * stale. This stub keeps every old link (deep links, bookmarks, in-app hrefs
 * not yet swept) working by forwarding to the new path with its query intact.
 */
export default async function IdentityVerificationRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) value.forEach((v) => query.append(key, v))
        else if (value !== undefined) query.set(key, value)
    }
    const qs = query.toString()
    redirect(`/profile/accounts-and-payments${qs ? `?${qs}` : ''}`)
}
