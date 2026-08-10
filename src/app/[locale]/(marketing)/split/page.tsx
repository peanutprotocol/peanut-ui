import { notFound } from 'next/navigation'

/**
 * Reserve /{locale}/split as a literal marketing route. Until the Split landing
 * is migrated, it must be an intentional 404 rather than falling through to the
 * legacy country/recipient-shaped catch-all.
 */
export default function SplitLandingPlaceholder() {
    notFound()
}
