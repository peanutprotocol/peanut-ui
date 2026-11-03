import RouteAlias from '@/components/Global/RouteAlias'

/**
 * The old standalone US bank-details screen, retired 2026-11-03: the US route is
 * /add-money/usa/bank. Old links and the QA harness still open this one.
 */
export default function USBankAlias() {
    return <RouteAlias to="/add-money/usa/bank" />
}
