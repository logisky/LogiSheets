/**
 * Translation setup.
 *
 * Two things decide which language the app speaks, in this order:
 *
 *   1. an explicit choice the user made, remembered on the device;
 *   2. `__APP_LOCALE__` — the locale the *distribution* was built for
 *      (crafts.config.json → CRAFT_DIST → vite `define`).
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
    lng: storedLocale() ?? distributionLocale(),
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
 * what they want, not a guess.
 */
export async function setLocale(locale: Locale): Promise<void> {
    try {
        localStorage.setItem(STORAGE_KEY, locale)
    } catch {
        // Not being able to remember it is not a reason not to do it.
    }
    await i18n.changeLanguage(locale)
}

export default i18n
