'use client'

import { useState, useEffect } from 'react'
import { MAINTAINABLE_ROUTES } from '@/config/routesUnderMaintenance'

const ROUTES = [
    { path: MAINTAINABLE_ROUTES.CASHOUT, label: 'Cashout' },
    { path: MAINTAINABLE_ROUTES.REQUEST, label: 'Request' },
    { path: MAINTAINABLE_ROUTES.SEND, label: 'Send' },
    { path: MAINTAINABLE_ROUTES.CLAIM, label: 'Claim' },
]

export default function MaintenanceAdmin() {
    // Initialize with empty array to prevent undefined
    const [maintenanceRoutes, setMaintenanceRoutes] = useState<string[]>([])
    const [apiKey, setApiKey] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Load current maintenance state
        setIsLoading(true)
        fetch('/api/maintenance')
            .then((res) => res.json())
            .then((data) => {
                setMaintenanceRoutes(data.routes || []) // Ensure we always have an array
            })
            .catch((error) => {
                console.error('Failed to fetch maintenance state:', error)
                setMaintenanceRoutes([])
            })
            .finally(() => setIsLoading(false))
    }, [])

    const toggleMaintenance = async (route: string) => {
        const isUnderMaintenance = !maintenanceRoutes.includes(route)

        try {
            const response = await fetch('/api/maintenance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    route,
                    isUnderMaintenance,
                }),
            })

            const data = await response.json()
            if (response.ok) {
                setMaintenanceRoutes(data.routes || []) // Ensure we always have an array
            } else {
                alert('Error updating maintenance state: ' + (data.error || 'Unknown error'))
            }
        } catch (error) {
            console.error('Failed to update maintenance state:', error)
            alert('Error updating maintenance state')
        }
    }

    if (isLoading) {
        return <div className="p-8">Loading...</div>
    }

    return (
        <div className="p-8">
            <h1 className="mb-6 text-2xl font-bold">Maintenance Control Panel</h1>

            <div className="mb-6">
                <label className="mb-2 block">API Key:</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="rounded border p-2"
                    placeholder="Enter API key"
                />
            </div>

            <div className="space-y-4">
                {ROUTES.map((route) => (
                    <div key={route.path} className="flex items-center gap-4">
                        <button
                            onClick={() => toggleMaintenance(route.path)}
                            className={`rounded px-4 py-2 ${
                                Array.isArray(maintenanceRoutes) && maintenanceRoutes.includes(route.path)
                                    ? 'bg-red-500 text-white'
                                    : 'bg-green-500 text-white'
                            }`}
                        >
                            {route.label}
                        </button>
                        <span>
                            {Array.isArray(maintenanceRoutes) && maintenanceRoutes.includes(route.path)
                                ? '🚫 Under Maintenance'
                                : '✅ Active'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
