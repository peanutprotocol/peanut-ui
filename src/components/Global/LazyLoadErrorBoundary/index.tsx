'use client'
import React from 'react'

interface LazyLoadErrorBoundaryProps {
    children: React.ReactNode
    fallback?: React.ReactNode
    onError?: (error: Error) => void
}

interface LazyLoadErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

/**
 * Error Boundary for lazy-loaded components
 * Catches chunk loading failures (network errors, 404s, timeouts) and provides
 * graceful fallback instead of crashing the entire app
 */
class LazyLoadErrorBoundary extends React.Component<LazyLoadErrorBoundaryProps, LazyLoadErrorBoundaryState> {
    constructor(props: LazyLoadErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): LazyLoadErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('LazyLoad Error Boundary caught error:', error, errorInfo)
        this.props.onError?.(error)
    }

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided, otherwise render null (graceful degradation)
            return this.props.fallback ?? null
        }

        return this.props.children
    }
}

export default LazyLoadErrorBoundary
