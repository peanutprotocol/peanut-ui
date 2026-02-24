import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'

interface BlogCardProps {
    slug: string
    title: string
    excerpt: string
    date: string
    category?: string
    hrefPrefix?: string
}

export function BlogCard({ slug, title, excerpt, date, category, hrefPrefix = '/blog' }: BlogCardProps) {
    return (
        <Link href={`${hrefPrefix}/${slug}`}>
            <Card
                shadowSize="4"
                className="h-full p-5 transition-all hover:shadow-primary-6 hover:-translate-x-1 hover:-translate-y-1"
            >
                {category && (
                    <span className="mb-2 inline-block rounded-sm bg-primary-1/20 px-2 py-0.5 text-xs font-semibold">
                        {category}
                    </span>
                )}
                <h3 className="text-lg font-bold leading-snug">{title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-black/70">{excerpt}</p>
                <time className="mt-3 block text-xs text-black/50">{date}</time>
            </Card>
        </Link>
    )
}
