import RouteAlias from '@/components/Global/RouteAlias'

/** Retired 2026-09-25; menu links, `?open=residence` links and native builds still carry it. Payment methods is the one list again. */
export default function AccountsAndPaymentsAlias() {
    return <RouteAlias to="/profile/payments" />
}
