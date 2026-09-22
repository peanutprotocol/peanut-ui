'use client'

import NavHeader from '@/components/Global/NavHeader'
import { DocNavDrawer } from './_components/DocNavDrawer'
import { DocSidebar } from './_components/DocSidebar'

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
    return (
        // This layout owns its own scroll box. The AppShell wraps every page in
        // #scrollable-content (overflow-y:auto) but that box never scrolls —
        // the shell is min-h-dvh, so it just grows and the WINDOW scrolls.
        // A sticky child therefore picks #scrollable-content as its scrollport
        // and never engages, on phones and on desktop alike. So this layout
        // caps itself at the viewport and gives the content its own scroll
        // instead of using sticky. The cap drops --safe-top because the shell
        // already pads by it, so a plain 100dvh would run past the fold on
        // edge-to-edge iOS/Android and drift the header out of view.
        <div className="flex h-[calc(100dvh_-_var(--spacing-safe-top))] w-full min-w-0 flex-col overflow-hidden">
            {/* Header — one row: back left, title centre, Menu in the trailing
                slot (board navigation.top.trailing, same idiom as Profile). It
                does not scroll, so Menu stays reachable however long the page
                is. No background of its own: it sits on the page background. */}
            <div className="shrink-0 px-4 pt-4">
                <NavHeader title="Design System" href="/dev" rightElement={<DocNavDrawer />} />
            </div>

            {/* Content area. The scrolling columns own the padding on the sides
                they clip — right and bottom — and the row keeps only left and
                top. An overflow box clips painting at its OWN padding edge, so
                padding on the row leaves a full-width button's 4px offset
                shadow (.btn-primary / .btn-stroke) outside the clip box, cut in
                a straight line. Same fix as the drawer scroll wrapper in
                Global/Drawer. Nothing paints up or left, so those two sides can
                stay on the row. The split is invisible: each column simply
                grows into the padding it now owns.
                Rule for anything added here: a container that clips must carry
                at least the biggest shadow offset used inside it (8px today —
                shadow-primary-8) as padding on its right and bottom.
                e2e/flows/ds-shadow-clip.spec.ts fails if one does not. */}
            <div className="flex min-h-0 min-w-0 flex-1 gap-6 pt-8 pl-4 md:pl-6 lg:pl-10">
                {/* Desktop sidebar — a full-height column that scrolls on its own,
                    so a nav longer than the viewport never pushes the page. */}
                <div className="hidden shrink-0 pb-8 md:block md:overflow-y-auto">
                    <DocSidebar />
                </div>

                {/* Main content — the only part of the page that scrolls */}
                <div className="min-w-0 flex-1 overflow-y-auto pr-4 pb-8 md:pr-6 lg:pr-10">{children}</div>
            </div>
        </div>
    )
}
