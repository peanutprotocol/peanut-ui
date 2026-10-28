type MaintenanceConfig = {
    enableFullMaintenance: boolean
    enableMaintenanceBanner: boolean
    maintenanceBannerPaths: readonly string[]
}

export function selectMaintenance({
    pathname,
    config,
    demo,
}: {
    pathname: string | null | undefined
    config: MaintenanceConfig
    demo: boolean
}): 'none' | 'scoped' | 'full' {
    if (typeof pathname !== 'string' || !pathname || demo || pathname === '/home' || pathname.startsWith('/home/'))
        return 'none'
    if (config.enableFullMaintenance) return 'full'
    const paths = config.maintenanceBannerPaths ?? []
    const targeted = paths.length === 0 || paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    return config.enableMaintenanceBanner && targeted ? 'scoped' : 'none'
}
