'use client'

/**
 * MINIMAL TEST PAGE for iOS debugging
 * This bypasses all custom hooks to test if basic rendering works
 */
export default function SupportTestPage() {
    return (
        <div
            style={{
                width: '100%',
                height: '100vh',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: '20px',
            }}
        >
            <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>iOS Test Page</h1>
            <p style={{ marginBottom: '10px' }}>If you see this, page rendering works!</p>
            <p style={{ fontSize: '12px', color: '#666' }}>
                User agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'Loading...'}
            </p>
            <div style={{ marginTop: '20px' }}>
                <a href="/support" style={{ color: 'blue', textDecoration: 'underline' }}>
                    Try /support page
                </a>
            </div>
        </div>
    )
}

