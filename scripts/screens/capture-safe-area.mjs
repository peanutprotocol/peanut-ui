export function installCaptureSafeArea(device) {
    const applySafeArea = () => {
        if (!document.documentElement) return false
        for (const [edge, value] of Object.entries(device.safeArea))
            document.documentElement.style.setProperty(`--safe-area-inset-${edge}`, `${value}px`)
        return true
    }
    if (!applySafeArea()) {
        const observer = new MutationObserver(() => {
            if (applySafeArea()) observer.disconnect()
        })
        observer.observe(document, { childList: true })
    }
}
