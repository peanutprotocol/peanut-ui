import Link from 'next/link'

interface BreadcrumbProps {
    /** Ordered trail, root first. The last entry is the current page and never links. */
    items: Array<{ name: string; href: string }>
    /** Accessible name of the nav landmark. Pass a translated string on localized pages. */
    label?: string
    className?: string
}

// 44px hit area over a 14px text row via the after: pseudo-element, the same
// recipe LinkButton uses. keep stacked crumbs on one line so the areas of two
// rows cannot overlap.
const CRUMB_LINK =
    'relative rounded underline decoration-foreground-primary/30 underline-offset-2 transition-colors duration-instant after:absolute after:inset-x-0 after:-inset-y-3 hover:text-foreground-primary active:text-foreground-primary focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

/**
 * The one breadcrumb trail for marketing and content pages. Replaces the two
 * hand-rolled copies that lived in ContentPage and the blog post page.
 *
 * Type is Body/S-SemiBold on the whole trail (ruled 2026-09-17) — the trail
 * reads as one line, so the current page is set apart by color, not weight.
 * The current page truncates: a post title is long enough to push the trail
 * onto a second row at 320px.
 *
 * No `fs` or server-only import, so it works inside a client component.
 */
export function Breadcrumb({ items, label = 'Breadcrumb', className }: BreadcrumbProps) {
    return (
        <nav aria-label={label} className={className}>
            <ol className="flex flex-wrap items-center gap-1 text-body-s-semibold text-foreground-secondary">
                {items.map((crumb, i) => {
                    const isCurrent = i === items.length - 1
                    return (
                        <li key={crumb.href} className="flex items-center gap-1">
                            {i > 0 && <span aria-hidden>/</span>}
                            {isCurrent ? (
                                <span aria-current="page" className="max-w-[200px] truncate text-foreground-primary">
                                    {crumb.name}
                                </span>
                            ) : (
                                <Link href={crumb.href} className={CRUMB_LINK}>
                                    {crumb.name}
                                </Link>
                            )}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
