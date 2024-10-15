interface Window {
    $crisp: any
}

declare namespace JSX {
    interface IntrinsicElements {
        'pwa-install': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
}
