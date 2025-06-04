export interface IRelatedApp {
    id: string
    platform: string
    url: string
}

export const usePwaUtils = () => {
    const checkIsPwaInstalled = async (): Promise<IRelatedApp[]> => {
        if ('getInstalledRelatedApps' in navigator)
            try {
                return await (navigator as any).getInstalledRelatedApps().then((relatedApps: IRelatedApp[]) => {
                    return relatedApps
                })
            } catch (e) {}

        return []
    }

    const checkPreviewInstallation = async () => {
        if ('getInstalledRelatedApps' in navigator) {
            try {
                const currentManifestUrl = `${window.location.origin}/manifest.webmanifest`
                const apps = await await (navigator as any).getInstalledRelatedApps()
                return apps.some((app: IRelatedApp) => app.url === currentManifestUrl)
            } catch (e) {}
        }
        return false
    }

    return {
        checkIsPwaInstalled,
        checkPreviewInstallation,
    }
}
