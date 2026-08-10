import { notFound } from 'next/navigation'

/** Reserve every unfinished Split subtree as a real dynamic 404. */
export default function SplitNamespacePlaceholder(): never {
    notFound()
}
