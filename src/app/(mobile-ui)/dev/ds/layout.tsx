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

            {/* Content area. The row has no padding and no gap: the scrolling
                columns own ALL of it, on every side. An overflow box clips
                painting at its OWN padding edge, so padding left on the row puts
                anything that paints outside its box — a button's 4px offset
                shadow (.btn-primary / .btn-secondary) to the right and bottom, a
                focus ring on all four sides — outside the clip box, cut in a
                straight line. Same fix as the drawer scroll wrapper in
                Global/Drawer. The split is invisible: the old gap-6 is the
                content column's left padding, and each column grows into the
                padding it now owns.
                Both columns are `relative`: an absolutely positioned child (the
                sr-only inputs in PinInput, say) otherwise takes #scrollable-content
                as its containing block, escapes the column's scroll box and
                makes the SHELL scrollable — the wheel then chains into it and
                header and sidebar scroll away with the page. overscroll-contain
                stops a column at its scroll end handing the rest of the
                wheel/touch delta to anything above it.
                Rule for anything added here: a container that clips carries
                padding on every side at least as big as what paints outside
                its children (8px today — shadow-primary-8 — and the focus ring),
                and a scroll box is `relative overscroll-contain`.
                e2e/flows/ds-shadow-clip.spec.ts and ds-clip-scroll.spec.ts fail
                if one does not. */}
            <div className="flex min-h-0 min-w-0 flex-1">
                {/* Desktop sidebar — a full-height column that scrolls on its own,
                    so a nav longer than the viewport never pushes the page. */}
                <div className="relative hidden shrink-0 overscroll-contain pt-8 pb-8 md:block md:overflow-y-auto md:pl-6 lg:pl-10">
                    <DocSidebar />
                </div>

                {/* Main content — the only part of the page that scrolls */}
                <div className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-8 pb-8 md:px-6 lg:pr-10">
                    {children}
                </div>
            </div>
        </div>
    )
}
