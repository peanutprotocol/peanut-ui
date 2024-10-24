import Layout from '@/components/Global/Layout'

export default function MaintenancePage() {
    return (
        <Layout>
            <div className="flex min-h-screen flex-col items-center justify-center">
                <h1 className="mb-4 text-4xl font-bold">Under Maintenance</h1>
                <p className="text-xl">
                    Our cashout feature is currently undergoing maintenance. We apologize for the inconvenience.
                </p>
            </div>
        </Layout>
    )
}
