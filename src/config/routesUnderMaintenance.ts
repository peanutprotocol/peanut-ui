interface MaintenanceConfig {
    routes: string[]
    maintenanceTime?: {
        start: string
        end: string
    }
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
        MAINTAINABLE_ROUTES.CASHOUT,
        MAINTAINABLE_ROUTES.REQUEST,
        MAINTAINABLE_ROUTES.SEND,
        MAINTAINABLE_ROUTES.CLAIM,
    ],
    maintenanceTime: {
        start: '2025-02-20T11:10:00Z',
        end: '2025-02-20T17:30:00Z',
    },
}

export default config
