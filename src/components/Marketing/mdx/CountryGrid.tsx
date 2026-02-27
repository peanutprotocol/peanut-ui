import { DestinationGrid } from '@/components/Marketing/DestinationGrid'

interface CountryGridProps {
    /** Comma-separated country slugs to show. If omitted, shows all countries. */
    countries?: string
    /** Country slug to exclude (typically the current page's country). */
    exclude?: string
    title?: string
}

/**
 * MDX wrapper for DestinationGrid. Renders a flag+name grid of country links.
 * Like Wise's "Send money to other countries" section.
 *
 * Usage in MDX:
 *   <CountryGrid exclude="argentina" title="Send money to other countries" />
 *   <CountryGrid countries="brazil,colombia,mexico" />
 */
export function CountryGrid({ countries, exclude, title = 'Send money to other countries' }: CountryGridProps) {
    let slugs: string[] | undefined

    if (countries) {
        slugs = countries.split(',').map((s) => s.trim())
    }

    if (exclude && slugs) {
        slugs = slugs.filter((s) => s !== exclude)
    }

    return (
        <section className="px-4 py-10 md:px-8 md:py-14">
            <div className="mx-auto max-w-5xl">
                <DestinationGrid countries={slugs} title={title} exclude={exclude} />
            </div>
        </section>
    )
}
