interface MaintenanceConfig {
    routes: string[]
}

export const MAINTAINABLE_ROUTES = {
    CASHOUT: '/cashout',
    REQUEST: '/request',
    SEND: '/send',
    CLAIM: '/claim',
} as const

// Static configuration - edit this file to change maintenance state
const config: MaintenanceConfig = {
    routes: [
        // MAINTAINABLE_ROUTES.CASHOUT, // Routes under maintenance
    ],
}

export default config
