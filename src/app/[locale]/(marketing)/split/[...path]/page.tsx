import { notFound } from 'next/navigation'

/** Reserve the unfinished Split namespace without pre-rendering any paths. */
export function generateStaticParams() {
    return []
}

export const dynamicParams = false

export default function SplitNamespacePlaceholder() {
    notFound()
}
