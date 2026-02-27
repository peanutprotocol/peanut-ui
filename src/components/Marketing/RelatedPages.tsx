import Link from 'next/link'

interface RelatedPagesProps {
    pages: Array<{ title: string; href: string }>
    title?: string
}

export function RelatedPages({ pages, title = 'Related Pages' }: RelatedPagesProps) {
    if (pages.length === 0) return null

    return (
        <section className="py-10 md:py-14">
            <h2 className="mb-6 text-h2 font-bold md:text-h1">{title}</h2>
            <ul className="flex flex-col gap-2">
                {pages.map((page) => (
                    <li key={page.href}>
                        <Link href={page.href} className="text-black underline">
                            {page.title}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
