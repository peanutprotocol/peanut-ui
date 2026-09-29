import RouteAlias from '@/components/Global/RouteAlias'

/** Retired 2026-09-25 when the page split into Accounts and Payments; menu links, `?open=residence` links and native builds still carry it. */
export default function AccountsAndPaymentsAlias() {
    return <RouteAlias to="/profile/accounts" />
}
