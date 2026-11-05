import { FAQsPanel } from '@/components/Global/FAQs'
import { DEMO_FAQ_ITEMS } from '../_components/preview-data'

// The one FAQ fold: Global/FAQs on the cream
// page ground, one heading pair (headingSmall 42 at 390 / headingMedium 80 at
// 1440), copy "FAQ." everywhere — /shhhhh included.
export default function FaqFoldPreview() {
    return (
        <main className="bg-background-page">
            <FAQsPanel heading="FAQ." questions={DEMO_FAQ_ITEMS} />
        </main>
    )
}
