import RouteAlias from '@/components/Global/RouteAlias'

export default function LegacyProfileRoute() {
    return <RouteAlias to="/settings" queryRedirect={{ key: 'open', value: 'residence', to: '/settings/details' }} />
}
