/**
 * The shell's centering wrapper. It used to slide the page content sideways
 * on home<->card navigation; ruled 2026-09-03 (kush): the slide is removed —
 * it animated in the same frame budget as the nav pill and the pair read as
 * jitter. The component name stays so AppShell is untouched and the slide is
 * one git revert away if design ever wants it back.
 */
export const TabSlide = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={className}>{children}</div>
)
