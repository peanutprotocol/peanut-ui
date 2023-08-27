'use client'
import * as global_components from '@/components/global'
import * as components from '@/components'

export default function CustomizeWidget() {
    return (
        <global_components.PageWrapper>
            <components.WidgetCustomizer />
        </global_components.PageWrapper>
    )
}
