import RouteAlias from '@/components/Global/RouteAlias'

/**
 * The KYC push and email deep links, including ones already delivered, carry this path with `?step=…&provider=…`.
 * Keep this alias: the backend still sends the path, and emails and pushes already delivered keep it after that changes.
 */
export default function IdentityVerificationAlias() {
    return <RouteAlias to="/profile/accounts" />
}
