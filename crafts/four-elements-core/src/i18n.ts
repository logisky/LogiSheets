/**
 * The sheet's own language.
 *
 * Two mechanisms, and the split matters:
 *
 *   - **Field names are not labels.** A block's schema field name is what
 *     every formula keys on (`BLOCKREF("counter", …, "pts")`), so it stays
 *     English forever. What a person reads is the block's HEADER LINE, which
 *     is ordinary cell text and free to say anything.
 *   - **Enum sets separate what a cell STORES from what it SHOWS.** A card
 *     cell holds `fire` — which is what `counter`'s keys are built from and
 *     what the craft and the model exchange — while the reader sees `火`.
 *
 * Between them, switching language rewrites no game data: the header cells and
 * the enum labels change, every key and every formula stays exactly as it was.
 * That is why a switch is safe in the middle of a game.
 */

import {ELEMENTS} from './sheet'

export const SHEET_LOCALES = ['en', 'zh-CN'] as const
export type SheetLocale = (typeof SHEET_LOCALES)[number]

/** `{en, zh-CN}` for one string. */
export type Phrase = Record<SheetLocale, string>

const p = (en: string, zh: string): Phrase => ({en, 'zh-CN': zh})

/** What each stored token shows as. Ids are never translated. */
const ELEMENT: Record<string, Phrase> = {
    fire: p('fire', '火'),
    wind: p('wind', '风'),
    earth: p('earth', '土'),
    water: p('water', '水'),
}

const SHAPE: Record<string, Phrase> = {
    triple: p('triple', '三连'),
    chain: p('chain', '顺子'),
    split: p('split', '夹心'),
    none: p('none', '无'),
}

const PHASE: Record<string, Phrase> = {
    draft: p('draft', '抽牌'),
    play: p('play', '出牌'),
    done: p('done', '结束'),
    '': p('', ''),
}

const SIDE: Record<string, Phrase> = {
    you: p('you', '你'),
    ai: p('ai', 'AI'),
}

const KNOB: Record<string, Phrase> = {
    cancelKeep: p('cancelKeep', '保留系数'),
    byElement: p('byElement', '按元素'),
}

/**
 * `fire>wind` shows as `火>风`.
 *
 * Built from ELEMENT rather than written out: sixteen hand-written pairs is
 * sixteen chances for the table and the keys to disagree.
 */
const PAIR: Record<string, Phrase> = {}
for (const a of ELEMENTS)
    for (const b of ELEMENTS)
        PAIR[`${a}>${b}`] = p(
            `${ELEMENT[a].en}>${ELEMENT[b].en}`,
            `${ELEMENT[a]['zh-CN']}>${ELEMENT[b]['zh-CN']}`
        )

/** The workbook enum sets, by id. A field names one through `fieldType`. */
export const ENUM_SETS: Record<string, Record<string, Phrase>> = {
    'fe-element': ELEMENT,
    'fe-shape': SHAPE,
    'fe-phase': PHASE,
    'fe-side': SIDE,
    'fe-knob': KNOB,
    'fe-pair': PAIR,
}

/** `upsertEnumSet` payloads for one language. Also the whole relabel. */
export function enumSetPayloads(locale: SheetLocale): unknown[] {
    return Object.entries(ENUM_SETS).map(([id, variants]) => ({
        type: 'upsertEnumSet',
        value: {
            id,
            variants: Object.entries(variants)
                // A blank token is a real cell state, not an option anyone
                // picks, and an empty id is refused.
                .filter(([vid]) => vid !== '')
                .map(([vid, phrase]) => ({id: vid, label: phrase[locale]})),
        },
    }))
}

// ---------------------------------------------------------------------------
// Header-line text, per block and field.
// ---------------------------------------------------------------------------

/** Compositional names get built, so a side's columns cannot drift apart. */
const sideOf = (f: string): Phrase =>
    f.startsWith('you') ? p('you', '你') : p('ai', 'AI')

const suffix = (f: string): string => f.replace(/^(you|ai)/, '')

const PARTS: Record<string, Phrase> = {
    Picks: p('picks', '已抽'),
    Plays: p('plays', '已出'),
    Pick: p('pick', '抽牌'),
    Pts: p('pts', '得分'),
    Shape: p('shape', '牌型'),
    Cancelled: p('cancelled', '被克'),
    Score: p('score', '分'),
    Cards: p('cards', '单牌'),
    Forms: p('forms', '牌型'),
    Total: p('total', '总分'),
    '1': p('1', '一'),
    '2': p('2', '二'),
    '3': p('3', '三'),
}

/** Field labels that are not compositional. */
const LABELS: Record<string, Phrase> = {
    pair: p('pair', '克制'),
    pts: p('pts', '分值'),
    shape: p('shape', '牌型'),
    value: p('value', '值'),
    cancels: p('cancels', '克制'),
    name: p('name', '名称'),
    n: p('n', '序号'),
    card: p('card', '牌'),
    round: p('round', '轮次'),
    offer1: p('offer1', '牌面一'),
    offer2: p('offer2', '牌面二'),
    offer3: p('offer3', '牌面三'),
    slot: p('slot', '格位'),
    you: p('you', '你'),
    ai: p('ai', 'AI'),
    w: p('w', '窗口'),
    element: p('element', '元素'),
    id: p('id', '键'),
    phase: p('phase', '阶段'),
    toMove: p('toMove', '执子'),
    nextSlot: p('nextSlot', '下一格'),
}

/** What the header line says for a field, in one language. */
export function fieldLabel(field: string, locale: SheetLocale): string {
    const direct = LABELS[field]
    if (direct) return direct[locale]
    const part = PARTS[suffix(field)]
    if (part && /^(you|ai)/.test(field)) {
        const side = sideOf(field)[locale]
        return locale === 'en'
            ? `${side} ${part.en}`
            : `${side}${part['zh-CN']}`
    }
    return field
}

/** The enum set a field's values are drawn from, if any. */
export function enumSetOf(ref: string, field: string): string | undefined {
    if (ref === 'counter' && field === 'pair') return 'fe-pair'
    if (ref === 'knob' && field === 'name') return 'fe-knob'
    if (ref === 'hand' && field === 'element') return 'fe-element'
    if (ref === 'deck' && field === 'card') return 'fe-element'
    if (ref === 'draft' && /^(offer[123]|youPick|aiPick)$/.test(field))
        return 'fe-element'
    if (ref === 'play' && (field === 'you' || field === 'ai'))
        return 'fe-element'
    if (ref === 'window' && /^(you|ai)[123]$/.test(field)) return 'fe-element'
    if (ref === 'window' && /Shape$/.test(field)) return 'fe-shape'
    if (ref === 'formation' && (field === 'shape' || field === 'cancels'))
        return 'fe-shape'
    if (ref === 'turn' && field === 'phase') return 'fe-phase'
    if (ref === 'turn' && field === 'toMove') return 'fe-side'
    return undefined
}
