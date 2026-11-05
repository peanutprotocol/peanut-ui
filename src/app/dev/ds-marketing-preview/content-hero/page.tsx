import { Hero } from '@/components/Marketing/mdx/Hero'

// The ONE content hero: the plain pink mdx Hero opens every content page —
// compare, send-to, pricing, help, blog. Rendered as shipped, marquee and
// spacer included.
export default function ContentHeroPreview() {
    return (
        <main className="bg-background-page pb-10">
            <Hero
                title="The plain pink content hero"
                subtitle="Every content page opens with this fold"
                cta="Get the app"
                ctaHref="/setup"
            />
        </main>
    )
}
