import {describe, expect, it} from 'vitest'
import {localeFromSearch} from './i18n'

/**
 * `?lang=` is how a link opens the app in a given language. It is read once, at
 * startup, so a mistake here shows up as "the Chinese link opened in English"
 * — quiet, and only visible to whoever the link was for.
 */
describe('localeFromSearch', () => {
    it('accepts the codes we ship', () => {
        expect(localeFromSearch('?lang=en')).toBe('en')
        expect(localeFromSearch('?lang=zh-CN')).toBe('zh-CN')
    })

    it('accepts the spellings people actually type', () => {
        for (const v of ['zh', 'zh-cn', 'zh_CN', 'zh-Hans', 'zh-TW'])
            expect(localeFromSearch(`?lang=${v}`)).toBe('zh-CN')
        expect(localeFromSearch('?lang=en-US')).toBe('en')
    })

    it('takes `locale` as an alias for `lang`', () => {
        expect(localeFromSearch('?locale=zh')).toBe('zh-CN')
        // `lang` wins when both are present; the documented one leads.
        expect(localeFromSearch('?locale=en&lang=zh')).toBe('zh-CN')
    })

    it('ignores a language we do not speak, rather than defaulting', () => {
        // undefined means "fall through to the user's own choice"; 'en' would
        // mean "override it with English".
        expect(localeFromSearch('?lang=fr')).toBeUndefined()
        expect(localeFromSearch('?lang=')).toBeUndefined()
        expect(localeFromSearch('')).toBeUndefined()
        expect(localeFromSearch('?file=x.xlsx')).toBeUndefined()
    })

    it('reads the parameter wherever it sits in the query string', () => {
        expect(localeFromSearch('?file=x.xlsx&lang=zh&dark=1')).toBe('zh-CN')
    })
})
