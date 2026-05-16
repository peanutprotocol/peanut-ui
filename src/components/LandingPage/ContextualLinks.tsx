import { twMerge } from 'tailwind-merge'

export type ContextualLink = {
    label: string
    href: string
    external?: boolean
}

type ContextualLinksProps = {
    links: ContextualLink[]
    label?: string
    separator?: string
    className?: string
}

export function ContextualLinks({ links, label, separator = ' · ', className }: ContextualLinksProps) {
    if (links.length === 0) return null

    return (
        <p className={twMerge('font-roboto-flex text-center text-sm md:text-base', className)}>
            {label && <span className="mr-2 opacity-70">{label}</span>}
            {links.map((link, i) => (
                <span key={link.href}>
                    {i > 0 && (
                        <span aria-hidden className="mx-1 opacity-50">
                            {separator}
                        </span>
                    )}
                    <a
                        href={link.href}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        className="text-n-1 underline hover:no-underline"
                    >
                        {link.label}
                    </a>
                </span>
            ))}
        </p>
    )
}
