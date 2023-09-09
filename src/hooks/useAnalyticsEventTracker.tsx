import ReactGA from 'react-ga4'

export const useAnalyticsEventTracker = (category: string) => {
    const eventTracker = (action: string, label: string) => {
        ReactGA.event({ category, action, label })
    }
    return eventTracker
}
