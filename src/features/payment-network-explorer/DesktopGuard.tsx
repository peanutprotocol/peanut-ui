export default function DesktopGuard() {
    return (
        <section
            className="flex h-full items-center justify-center p-6 text-center"
            aria-labelledby="desktop-only-title"
        >
            <div className="max-w-sm rounded-sm border border-n-1 bg-white p-6 shadow-[4px_4px_0_#000]">
                <h1 id="desktop-only-title" className="text-xl font-bold">
                    Open on a desktop
                </h1>
                <p className="mt-2 text-sm text-grey-1">The explorer needs a screen at least 1024px wide.</p>
            </div>
        </section>
    )
}
