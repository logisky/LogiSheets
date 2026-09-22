/**
 * 四象 — the sheet. Every rule the game has lives in this file as a block
 * definition, and nothing in it is evaluated here: the strings are formulas the
 * engine computes. See design/four-elements-game.md.
 *
 * Two engine constraints shaped the layout, both established by probe
 * (`packages/node/__tests__/block-formula-capabilities.test.ts`):
 *
 *   - **A `BLOCKREF` field name must be a literal.** `BLOCKREF(b, k, #FIELD(x))`
 *     is `#NAME?`. So the counter table is a flat list keyed `"fire>wind"`
 *     rather than a 4×4 matrix — which also lets a single pair be worth more
 *     than the rest, where a matrix row could not.
 *   - **No array formulas.** Every cell reduces to a scalar, so wide helper
 *     columns do the work an array formula would.
 */

export const ELEMENTS = ['fire', 'wind', 'earth', 'water'] as const
export type Element = (typeof ELEMENTS)[number]

/** Who beats whom, by default. Editable in the sheet like any other cell. */
const BEATS: Record<Element, Element> = {
    fire: 'wind',
    wind: 'earth',
    earth: 'water',
    water: 'fire',
}

export const SLOTS = 5
export const DRAFT_ROUNDS = 5
/** Three revealed per round: one each, one burned. */
export const OFFER = 3

// ---------------------------------------------------------------------------
// Block definitions
// ---------------------------------------------------------------------------

export interface FieldDef {
    name: string
    /** A formula template. `#KEY`, `#FIELD("x")` and `BLOCKREF` are resolved
     *  per row by the engine. Absent means the field is written, not derived. */
    valueFormula?: string
    /**
     * What the column means, in prose. The field header shows it on hover.
     *
     * Not decoration. The engine materialises `#FIELD("x")` into a plain A1
     * reference — `(B90)` — because a same-row sibling ref has to go through
     * `#FIELD` and nothing else is allowed, so the stored formula cannot name
     * what it reads. This is where the name goes instead.
     */
    description?: string
}

export interface BlockDef {
    /** `refName` — how every formula in the workbook addresses this block. */
    ref: string
    /** What the table is for. Shown to anyone reading the sheet, and the one
     *  thing an AI reading the workbook has to go on. */
    description?: string
    fields: FieldDef[]
    /** Seed rows, in field order. Rows the craft fills in later are blank. */
    rows: (string | number)[][]
}

const knob = (name: string) => `BLOCKREF("knob","${name}","value")`
/**
 * Points `a` scores against `b`, or 0.
 *
 * `IFERROR` is not decoration: an unplayed slot concatenates to the key `">"`,
 * which is not in the table. Guarding at the *use* would not help — an error
 * reaching an `IF` condition propagates before a branch is chosen — so every
 * lookup is made total where it is read.
 */
const beats = (a: string, b: string) =>
    `IFERROR(BLOCKREF("counter",${a}&">"&${b},"pts"),0)`

/** Every ordered pair, so the table is complete and every cell is editable. */
function counterRows(): (string | number)[][] {
    const rows: (string | number)[][] = []
    for (const a of ELEMENTS)
        for (const b of ELEMENTS)
            rows.push([`${a}>${b}`, BEATS[a] === b ? 1 : 0])
    return rows
}

/** The rules. Written once at setup; the player may edit any of it, any time. */
export const COUNTER: BlockDef = {
    ref: 'counter',
    description:
        'Who beats whom. One row per ordered pair of elements; edit a `pts` ' +
        'and every score on the sheet moves, because this is the only place ' +
        'that says what a counter is worth.',
    fields: [
        {
            name: 'pair',
            description: 'Attacker and defender, as "attacker>defender".',
        },
        {
            name: 'pts',
            description:
                'What the attacker scores against that defender. 0 means no counter.',
        },
    ],
    rows: counterRows(),
}

export const FORMATION: BlockDef = {
    ref: 'formation',
    description:
        'What each three-card shape is worth, and which shape it cancels. ' +
        'The cancel cycle runs against the value order, so the cheapest ' +
        'shape kills the dearest.',
    fields: [
        {
            name: 'shape',
            description:
                'triple = AAA, chain = a run down the counter cycle, split = ABA.',
        },
        {name: 'value', description: 'Points the shape is worth uncancelled.'},
        {
            name: 'cancels',
            description:
                'The shape this one cancels when the two sides face off in the same window.',
        },
    ],
    // The counter runs against the value order: the cheapest kills the dearest.
    rows: [
        ['triple', 6, 'chain'],
        ['chain', 4, 'split'],
        ['split', 2, 'triple'],
        ['none', 0, ''],
    ],
}

export const KNOB: BlockDef = {
    ref: 'knob',
    description:
        'The two dials that change how scoring works, kept out of the ' +
        'formulas so they can be changed mid-game.',
    fields: [
        {name: 'name', description: 'Which dial.'},
        {
            name: 'value',
            description:
                'cancelKeep: what a cancelled formation keeps (0 = dead, 0.5 = halved). ' +
                'byElement: 1 = same-shape windows are resolved by element.',
        },
    ],
    rows: [
        // What a cancelled formation keeps. 0 = dead, 0.5 = halved.
        ['cancelKeep', 0],
        // 1 = a same-shape window is resolved by the element matrix, so a
        // Water-Triple cancels a Fire-Triple. 0 = both keep their value.
        ['byElement', 0],
    ],
}

/** The shuffle. The craft's one piece of non-rule state — a seed, not a rule. */
export const DECK: BlockDef = {
    ref: 'deck',
    description:
        'The shuffle, dealt three cards per draft round. The only thing on ' +
        'this sheet that is luck rather than rule.',
    fields: [
        {name: 'n', description: 'Position in the deck, 1-based.'},
        {name: 'card', description: 'The element dealt at that position.'},
    ],
    rows: Array.from({length: DRAFT_ROUNDS * OFFER}, (_, i) => [i + 1, '']),
}

/** Written by the craft: two picks per round. The offers derive from `deck`. */
export const DRAFT: BlockDef = {
    ref: 'draft',
    description:
        'One row per draft round. The three offers are cut from `deck`; the ' +
        'two picks are written by the craft. The player leads every round, ' +
        'and the third card is burned.',
    fields: [
        {name: 'round', description: 'Draft round, 1-based.'},
        ...Array.from({length: OFFER}, (_, i) => ({
            name: `offer${i + 1}`,
            description: `Card ${
                i + 1
            } of the three revealed this round, cut from \`deck\`.`,
            valueFormula: `=BLOCKREF("deck",(#KEY-1)*${OFFER}+${i + 1},"card")`,
        })),
        {name: 'youPick', description: 'The card the player took this round.'},
        {name: 'aiPick', description: 'The card the AI took this round.'},
    ],
    rows: Array.from({length: DRAFT_ROUNDS}, (_, i) => [
        i + 1,
        '',
        '',
        '',
        '',
        '',
    ]),
}

/** Written by the craft, one cell per turn. This block IS the board. */
export const PLAY: BlockDef = {
    ref: 'play',
    description:
        'The board: one row per slot, the two lines side by side. The point ' +
        'columns settle that slot head-to-head through `counter`.',
    fields: [
        {name: 'slot', description: 'Board position, 1-based, left to right.'},
        {name: 'you', description: "The player's card in this slot."},
        {name: 'ai', description: "The AI's card in this slot."},
        {
            name: 'youPts',
            description:
                "What the player's card scores against the AI's in this slot, per `counter`.",
            valueFormula: `=${beats('#FIELD("you")', '#FIELD("ai")')}`,
        },
        {
            name: 'aiPts',
            description:
                "What the AI's card scores against the player's in this slot, per `counter`.",
            valueFormula: `=${beats('#FIELD("ai")', '#FIELD("you")')}`,
        },
    ],
    rows: Array.from({length: SLOTS}, (_, i) => [i + 1, '', '', '', '']),
}

/**
 * One row per three-slot window. The three cards of each side are pulled into
 * helper columns first, because the shape formula names them four times and the
 * engine has no array formulas to fold that with.
 */
export const WINDOW: BlockDef = (() => {
    // A BLOCKREF at an EMPTY cell is `#VALUE!`, not blank — so an unplayed
    // slot is turned back into "" here, before anything compares it.
    const pull = (side: 'you' | 'ai', n: 0 | 1 | 2): FieldDef => ({
        name: `${side}${n + 1}`,
        description: `${side === 'you' ? 'Player' : 'AI'} card in the ${
            ['first', 'second', 'third'][n]
        } slot of this window, "" if unplayed.`,
        valueFormula: `=IFERROR(BLOCKREF("play",#KEY${
            n ? `+${n}` : ''
        },"${side}"),"")`,
    })
    const shape = (side: 'you' | 'ai'): FieldDef => {
        const [a, b, c] = ([0, 1, 2] as const).map(
            (n) => `#FIELD("${side}${n + 1}")`
        )
        return {
            name: `${side}Shape`,
            description:
                `Shape formed by ${side}1/${side}2/${side}3: triple if all ` +
                `three match, split if first and third match, chain if each ` +
                `beats the next in \`counter\`, else none.`,
            valueFormula:
                `=IF(OR(${a}="",${b}="",${c}=""),"none",` +
                `IF(AND(${a}=${b},${b}=${c}),"triple",` +
                `IF(AND(${a}=${c},${a}<>${b}),"split",` +
                `IF(AND(${beats(a, b)}>0,${beats(b, c)}>0),"chain",` +
                `"none"))))`,
        }
    }
    /** Cancelled by the shape opposite, or — with the toggle on — by element. */
    const cancelled = (side: 'you' | 'ai', other: 'you' | 'ai'): FieldDef => ({
        name: `${side}Cancelled`,
        description:
            `1 when ${other}Shape cancels ${side}Shape per \`formation\`, or ` +
            `— with the byElement knob on — when the shapes match ` +
            `and ${other}'s leading card beats ${side}'s.`,
        valueFormula:
            `=IF(OR(` +
            `IFERROR(BLOCKREF("formation",#FIELD("${other}Shape"),"cancels"),"")=#FIELD("${side}Shape"),` +
            `AND(${knob('byElement')}=1,` +
            `#FIELD("${other}Shape")=#FIELD("${side}Shape"),` +
            `#FIELD("${side}Shape")<>"none",` +
            `${beats(`#FIELD("${other}1")`, `#FIELD("${side}1")`)}>0)` +
            `),1,0)`,
    })
    const score = (side: 'you' | 'ai'): FieldDef => ({
        name: `${side}Score`,
        description:
            `${side}Shape's value from \`formation\`, times the ` +
            `cancelKeep knob when ${side}Cancelled is 1.`,
        valueFormula:
            `=IFERROR(BLOCKREF("formation",#FIELD("${side}Shape"),"value"),0)` +
            `*IF(#FIELD("${side}Cancelled")=1,${knob('cancelKeep')},1)`,
    })
    return {
        ref: 'window',
        description:
            'One row per three-slot window, overlapping: window w covers ' +
            'slots w, w+1 and w+2. The six pull columns exist because the ' +
            'engine has no array formulas — the shape formula names each ' +
            'card four times, and a pull column is what folds that.',
        fields: [
            {
                name: 'w',
                description: 'Window number; covers slots w, w+1, w+2.',
            },
            pull('you', 0),
            pull('you', 1),
            pull('you', 2),
            pull('ai', 0),
            pull('ai', 1),
            pull('ai', 2),
            shape('you'),
            shape('ai'),
            cancelled('you', 'ai'),
            cancelled('ai', 'you'),
            score('you'),
            score('ai'),
        ],
        rows: Array.from({length: SLOTS - 2}, (_, i) => [
            i + 1,
            ...Array(12).fill(''),
        ]),
    }
})()

/** Cards drafted but not yet committed. Also the legality check. */
export const HAND: BlockDef = {
    ref: 'hand',
    description:
        'What each side still holds: drafted minus played, counted per ' +
        'element. This is also the legality check — a card with 0 here ' +
        'cannot be played.',
    fields: [
        {name: 'element', description: 'The element counted on this row.'},
        ...(['you', 'ai'] as const).map((side) => ({
            name: side,
            description: `Copies of this element ${side} has drafted but not yet played.`,
            valueFormula:
                `=COUNTIF(BLOCKREFS("draft","*","${side}Pick"),#KEY)` +
                `-COUNTIF(BLOCKREFS("play","*","${side}"),#KEY)`,
        })),
    ],
    rows: ELEMENTS.map((e) => [e, '', '']),
}

/**
 * Whose move it is, and where it goes. The lead is fixed per phase — the player
 * leads every draft round, the AI every play turn — so this is counting, not a
 * state machine.
 */
export const TURN: BlockDef = {
    ref: 'turn',
    description:
        'The whole turn order, as one row of counting. Nothing writes here: ' +
        'phase, whose move it is and where the card goes are all derived ' +
        'from how many picks and plays exist.',
    fields: [
        {name: 'id', description: 'Single-row key; always "t".'},
        ...(
            [
                [
                    'youPicks',
                    '=COUNTIF(BLOCKREFS("draft","*","youPick"),"<>")',
                    'How many draft picks the player has made.',
                ],
                [
                    'aiPicks',
                    '=COUNTIF(BLOCKREFS("draft","*","aiPick"),"<>")',
                    'How many draft picks the AI has made.',
                ],
                [
                    'youPlays',
                    '=COUNTIF(BLOCKREFS("play","*","you"),"<>")',
                    'How many cards the player has committed to the board.',
                ],
                [
                    'aiPlays',
                    '=COUNTIF(BLOCKREFS("play","*","ai"),"<>")',
                    'How many cards the AI has committed to the board.',
                ],
                [
                    'phase',
                    `=IF(#FIELD("youPicks")+#FIELD("aiPicks")<${
                        DRAFT_ROUNDS * 2
                    },"draft",` +
                        `IF(#FIELD("youPlays")+#FIELD("aiPlays")<${
                            SLOTS * 2
                        },"play","done"))`,
                    'draft until both sides have ten picks, then play until the board is full, then done.',
                ],
                [
                    'toMove',
                    '=IF(#FIELD("phase")="draft",' +
                        'IF(#FIELD("youPicks")=#FIELD("aiPicks"),"you","ai"),' +
                        'IF(#FIELD("phase")="play",' +
                        'IF(#FIELD("aiPlays")=#FIELD("youPlays"),"ai","you"),""))',
                    'Whose move it is. The lead is fixed per phase, so this is counting, not a state machine.',
                ],
                [
                    'round',
                    '=MIN(#FIELD("youPicks"),#FIELD("aiPicks"))+1',
                    'The draft round now in progress, 1-based.',
                ],
                [
                    'nextSlot',
                    '=IF(#FIELD("toMove")="ai",#FIELD("aiPlays"),#FIELD("youPlays"))+1',
                    'The board slot the side to move will fill next.',
                ],
            ] as const
        ).map(([name, valueFormula, description]) => ({
            name,
            valueFormula,
            description,
        })),
    ],
    rows: [['t', ...Array(8).fill('')]],
}

export const SCORE: BlockDef = {
    ref: 'score',
    description:
        'The final tally. Card points settle slot by slot, formation points ' +
        'come from the overlapping windows, and the total is the two added.',
    fields: [
        {name: 'id', description: 'Single-row key; always "s".'},
        ...(['you', 'ai'] as const).flatMap((side) => [
            {
                name: `${side}Cards`,
                description: `Sum of ${side}Pts over every board slot.`,
                valueFormula: `=SUM(BLOCKREFS("play","*","${side}Pts"))`,
            },
            {
                name: `${side}Forms`,
                description: `Sum of ${side}Score over every window, after cancellation.`,
                valueFormula: `=SUM(BLOCKREFS("window","*","${side}Score"))`,
            },
            {
                name: `${side}Total`,
                description: `${side}Cards + ${side}Forms.`,
                valueFormula: `=#FIELD("${side}Cards")+#FIELD("${side}Forms")`,
            },
        ]),
    ],
    rows: [['s', ...Array(6).fill('')]],
}

/**
 * Declaration order is load-bearing: `BindFormSchema` folds `BLOCKREF("X", …)`
 * into stable ids at parse time, so a block must be declared after everything
 * its formulas name.
 */
export const BLOCKS: BlockDef[] = [
    COUNTER,
    FORMATION,
    KNOB,
    DECK,
    DRAFT,
    PLAY,
    WINDOW,
    HAND,
    TURN,
    SCORE,
]
