interface Window {
    $crisp: any
}

declare namespace JSX {
    interface IntrinsicElements {
        // Define custom pwainstall element into JSX namespace
        'pwa-install': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
}
