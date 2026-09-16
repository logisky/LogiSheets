/**
 * Translation setup.
 *
 * Three things decide which language the app speaks, in this order:
 *
 *   1. `?lang=` (or `?locale=`) in the URL — a link that opens the app in a
 *      given language, so nobody has to land on the wrong one and then hunt
 *      for the switcher;
 *   2. an explicit choice the user made, remembered on the device;
 *   3. `__APP_LOCALE__` — the locale the *distribution* was built for
 *      (crafts.config.json → CRAFT_DIST → vite `define`).
 *
 * The URL wins but does NOT overwrite the remembered choice: a `?lang=en` link
 * someone sends you is a request about that visit, not a new setting for your
 * device. It survives reloads because it is in the address bar; drop the
 * parameter and you are back to whatever you had chosen. Switching language
 * in the UI while such a link is open rewrites the parameter instead of
 * leaving it to contradict the UI on the next reload.
 *
 * The browser's own language is deliberately NOT consulted. We ship a Chinese
 * build and an English build, and a user who installed the English one on a
 * Chinese machine asked for English; letting the OS override that would make
 * the two builds indistinguishable and untestable. Both dictionaries are in
 * every bundle (they are tens of KB), so the choice is always reversible.
 *
 * Locale codes are BCP-47 and must match the resource keys exactly. They did
 * not, once: resources were registered under `cn` while every browser reports
 * `zh-CN`, so i18next fell through to English and the Chinese dictionary was
 * unreachable for its whole life.
 *
 * The guard against the next spelling of that is `normalizeLocale`, ours, not
 * i18next's `supportedLngs`. That option resolves by BASE language — with
 * `supportedLngs: ['en', 'zh-CN']` it asks whether `zh` is listed, decides no,
 * and quietly serves English for a `zh-CN` request. Since we always choose
 * `lng` ourselves and never consult the browser, i18next needs no opinion on
 * which languages are supported; normalizing on the way in is both narrower
 * and legible.
 */

import i18n from 'i18next'
import {initReactI18next} from 'react-i18next'
import en from '../../../resources/locale/en.json'
import zhCN from '../../../resources/locale/zh-CN.json'

export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** Where a user's explicit language choice is remembered. */
const STORAGE_KEY = 'logisheets.locale'

/**
 * Query parameters a link may use to ask for a language. `lang` is the one we
 * document; `locale` is here because it is the other name people reach for,
 * and a link that silently does nothing is worse than a second alias.
 */
const URL_PARAMS = ['lang', 'locale'] as const

function isLocale(v: string | null | undefined): v is Locale {
    return SUPPORTED_LOCALES.includes(v as Locale)
}

/**
 * Any reasonable spelling of a language we speak → the exact code our resource
 * bundles are keyed by. `zh`, `zh-Hans`, `zh-TW`, `zh_CN` all mean the Chinese
 * dictionary; anything we don't recognise means English. Returns undefined for
 * "nothing was specified", which is different from "something unusable was".
 */
function normalizeLocale(v: string | null | undefined): Locale | undefined {
    if (!v) return undefined
    if (isLocale(v)) return v
    const base = v.replace('_', '-').split('-')[0].toLowerCase()
    if (base === 'zh') return 'zh-CN'
    if (base === 'en') return 'en'
    return undefined
}

/** The locale this build was produced for. */
function distributionLocale(): Locale {
    const l = typeof __APP_LOCALE__ !== 'undefined' ? __APP_LOCALE__ : undefined
    return normalizeLocale(l) ?? DEFAULT_LOCALE
}

/**
 * The language a query string asks for, if any. Anything we don't speak
 * (`?lang=fr`) is treated as "not specified" rather than as English, so a typo
 * falls through to the user's own choice instead of overriding it.
 *
 * Takes the query string rather than reading `location` so it can be tested
 * without a DOM.
 */
export function localeFromSearch(search: string): Locale | undefined {
    const params = new URLSearchParams(search)
    for (const key of URL_PARAMS) {
        const l = normalizeLocale(params.get(key))
        if (l) return l
    }
    return undefined
}

function urlLocale(): Locale | undefined {
    try {
        return localeFromSearch(window.location.search)
    } catch {
        // No DOM (SSR, unit tests): there is no URL to read.
        return undefined
    }
}

/**
 * Keep a `?lang=` already in the address bar in step with the UI. Only rewrites
 * a parameter that is there — we never add one to a clean URL.
 */
function syncUrlLocale(locale: Locale): void {
    try {
        const url = new URL(window.location.href)
        let changed = false
        for (const key of URL_PARAMS) {
            if (!url.searchParams.has(key)) continue
            url.searchParams.set(key, locale)
            changed = true
        }
        if (changed) window.history.replaceState(null, '', url.toString())
    } catch {
        // Not worth failing a language switch over.
    }
}

function storedLocale(): Locale | undefined {
    try {
        return normalizeLocale(localStorage.getItem(STORAGE_KEY))
    } catch {
        // Private mode / blocked storage: fall back to the build's locale.
        return undefined
    }
}

i18n.use(initReactI18next).init({
    debug: false,
    lng: urlLocale() ?? storedLocale() ?? distributionLocale(),
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
        escapeValue: false, // React escapes by default
    },
    resources: {
        en: {translation: en},
        'zh-CN': {translation: zhCN},
    },
})

/** The language the UI is in right now. */
export function getLocale(): Locale {
    return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
}

/**
 * Switch language and remember the choice on this device. The stored value
 * outranks the distribution's locale from then on — this is the user saying
 * what they want, not a guess. If the page was opened with `?lang=`, that
 * parameter is rewritten too, so a reload does not undo the switch.
 */
export async function setLocale(locale: Locale): Promise<void> {
    try {
        localStorage.setItem(STORAGE_KEY, locale)
    } catch {
        // Not being able to remember it is not a reason not to do it.
    }
    syncUrlLocale(locale)
    await i18n.changeLanguage(locale)
}

export default i18n
