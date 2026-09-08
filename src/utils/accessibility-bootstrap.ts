import { ACCESSIBILITY_STORAGE_KEY, REDUCED_MOTION_QUERY } from './accessibility-preferences'

/** Runs in the document head before content paints, without waiting for app chunks. */
export const ACCESSIBILITY_BOOTSTRAP_SCRIPT = `
(function () {
    var preferences = {};
    try {
        preferences = JSON.parse(window.localStorage.getItem('${ACCESSIBILITY_STORAGE_KEY}')) || {};
    } catch (e) {}
    var systemReduced = false;
    try {
        systemReduced = window.matchMedia('${REDUCED_MOTION_QUERY}').matches;
    } catch (e) {}
    var root = document.documentElement;
    root.dataset.largerText = String(preferences.largerText === true);
    root.dataset.highContrast = String(preferences.highContrast === true);
    root.dataset.reducedMotion = String(
        preferences.motion === 'on' || (preferences.motion !== 'off' && systemReduced)
    );
})();
`
