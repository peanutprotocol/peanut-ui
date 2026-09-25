import RouteAlias from '@/components/Global/RouteAlias'

/** The KYC push and email deep links, including ones already delivered, carry this path with `?step=…&provider=…`. */
export default function IdentityVerificationAlias() {
    return <RouteAlias to="/profile/accounts" />
}
