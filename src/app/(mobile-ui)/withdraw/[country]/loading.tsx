import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'

/**
 * Shown while a withdraw destination route loads — the bank form and the review
 * step below it.
 *
 * These are dynamic routes, so the browser fetches their payload and then their
 * chunks before anything can paint. Without a boundary the previous screen sat
 * there unchanged for the whole of it, which on a phone is about two seconds of
 * a screen that looks broken. This is the same shell the pages render, so the
 * header does not move when the real one arrives.
 *
 * A server component on purpose: it must paint without waiting for any of the
 * client bundle. `titleKey` and `href` are NavHeader's server-side props — the
 * title is resolved from the navigation namespace and back is a plain link,
 * because the router this would otherwise call has not loaded yet.
 */
export default function WithdrawDestinationLoading() {
    return (
        <div className="flex min-h-inherit w-full flex-col justify-start gap-8 self-start">
            <NavHeader titleKey="withdraw" href="/withdraw" />
            <Loading variant="mascot" />
        </div>
    )
}
