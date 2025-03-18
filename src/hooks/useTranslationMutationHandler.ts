import { useEffect, useRef } from 'react'

// handles translation service dom mutations to prevent errors while allowing translations
export const useTranslationMutationHandler = (targetRef: React.RefObject<HTMLElement>) => {
    // keep reference to observer instance for cleanup
    const observerRef = useRef<MutationObserver | null>(null)

    useEffect(() => {
        const setupObserver = () => {
            if (!targetRef.current) return

            if (observerRef.current) {
                observerRef.current.disconnect()
            }

            observerRef.current = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) {
                                try {
                                    const element = node as Element
                                    // handle translated content nodes that google translate adds
                                    if (element.hasAttribute('data-translated')) {
                                        const parent = element.parentElement
                                        if (parent) {
                                            // remove any duplicate translations to prevent conflicts
                                            const existingTranslations = parent.querySelectorAll('[data-translated]')
                                            existingTranslations.forEach((el) => {
                                                if (el !== element && el.textContent === element.textContent) {
                                                    el.remove()
                                                }
                                            })

                                            // append new translation if not already present
                                            if (!parent.contains(element)) {
                                                requestAnimationFrame(() => {
                                                    try {
                                                        parent.appendChild(element)
                                                    } catch (e) {
                                                        console.error(e)
                                                    }
                                                })
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error(e)
                                }
                            }
                        })
                    }
                })
            })

            // observe changes to dom structure and attributes
            observerRef.current.observe(targetRef.current, {
                childList: true,
                subtree: true,
                attributes: true,
            })
        }

        setupObserver()
        return () => observerRef.current?.disconnect()
    }, [targetRef])
}
