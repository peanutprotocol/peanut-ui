'use client'

import { Component, Suspense, type ReactNode } from 'react'

type Props = { handoff: string; children: ReactNode }

/**
 * A creator page that fails to render still reaches its handoff, as if the creator had no page.
 * The Suspense keeps a server render error from failing the whole response (a 500); the browser
 * then renders the page again, and this boundary catches the error there.
 */
export default class CreatorPageBoundary extends Component<Props, { failed: boolean }> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: Error) {
        console.error('creator page fell back to the handoff', error)
        window.location.replace(this.props.handoff)
    }

    render() {
        if (this.state.failed) return null
        return <Suspense fallback={null}>{this.props.children}</Suspense>
    }
}
