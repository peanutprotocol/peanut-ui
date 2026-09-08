'use client'

import { forwardRef, type ComponentType, type RefAttributes } from 'react'
import { motion as baseMotion, type HTMLMotionProps, type Transition } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useAccessibility'

const instant: Transition = { duration: 0, delay: 0, repeat: 0, type: 'tween' }
const settle = <T,>(target: T): T =>
    target && typeof target === 'object' && !Array.isArray(target) ? ({ ...target, transition: instant } as T) : target

/** MotionConfig covers transforms/layout. These wrappers also cover explicit
 * per-component transitions and changes to the preference after mounting. */
function accessibleMotion<Tag extends 'div' | 'span' | 'img' | 'button'>(tag: Tag) {
    const Component = baseMotion[tag] as unknown as ComponentType<HTMLMotionProps<Tag> & RefAttributes<HTMLElement>>
    const Accessible = forwardRef<HTMLElement, HTMLMotionProps<Tag>>((incomingProps, ref) => {
        const props = incomingProps as HTMLMotionProps<Tag>
        const reduced = useReducedMotion()
        if (!reduced) return <Component {...(props as HTMLMotionProps<Tag>)} ref={ref} />
        return (
            <Component
                {...(props as HTMLMotionProps<Tag>)}
                ref={ref}
                initial={false}
                animate={settle(props.animate)}
                exit={settle(props.exit)}
                whileInView={settle(props.whileInView)}
                transition={instant}
                variants={
                    props.variants &&
                    Object.fromEntries(
                        Object.entries(props.variants).map(([key, variant]) => [
                            key,
                            typeof variant === 'function'
                                ? (...args: Parameters<typeof variant>) => settle(variant(...args))
                                : settle(variant),
                        ])
                    )
                }
            />
        )
    })
    Accessible.displayName = `AccessibleMotion.${tag}`
    return Accessible
}

export const motion = {
    div: accessibleMotion('div'),
    span: accessibleMotion('span'),
    img: accessibleMotion('img'),
    button: accessibleMotion('button'),
}
