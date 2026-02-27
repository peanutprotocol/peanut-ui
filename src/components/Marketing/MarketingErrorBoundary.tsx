'use client'

import { Component, type ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
}

export class MarketingErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('MDX rendering error:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
                        <h2 className="text-2xl font-bold text-n-1">Content unavailable</h2>
                        <p className="mt-4 text-grey-1">Please try refreshing the page.</p>
                    </div>
                )
            )
        }
        return this.props.children
    }
}
