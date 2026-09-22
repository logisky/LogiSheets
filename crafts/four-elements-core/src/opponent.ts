/**
 * Letting the model take a turn.
 *
 * The model proposes; the craft decides. An answer is checked against what the
 * sheet says is legal before anything is written, and a bad one is re-asked
 * with the reason — bounded, because a model that will not pick from a list of
 * four is not going to on the tenth try either.
 */

import {ELEMENTS, type Element} from './sheet'
import type {Game} from './game'

/** `window.craftAi.ask`, narrowed to what this needs. */
export type AskFn = (
    role: string,
    input: string,
    opts?: {signal?: AbortSignal; tier?: 'fast' | 'default'}
) => Promise<unknown>

export interface AiTurn {
    card: Element
    taunt?: string
    /** How many times the model had to be asked. 1 when it answered cleanly. */
    tries: number
}

export class AiRefused extends Error {}

const isElement = (v: unknown): v is Element =>
    typeof v === 'string' && (ELEMENTS as readonly string[]).includes(v)

/**
 * Ask the model for a move and commit it.
 *
 * `note` rides along with the question — this is where a difficulty or a
 * persona goes, rather than into a second role.
 */
export async function takeAiTurn(
    game: Game,
    ask: AskFn,
    opts: {note?: string; signal?: AbortSignal; maxTries?: number} = {}
): Promise<AiTurn> {
    const maxTries = opts.maxTries ?? 3
    const turn = await game.turn()
    if (turn.toMove !== 'ai') throw new AiRefused('it is not the AI to move')

    const legal = await game.legal()
    if (!legal.length) throw new AiRefused('the AI has no legal move')

    const where =
        turn.phase === 'draft'
            ? `Draft round ${turn.round}.`
            : `Play, slot ${turn.nextSlot}.`
    const rejected: string[] = []

    for (let tries = 1; tries <= maxTries; tries++) {
        const input = rejected.length
            ? `${where} ${rejected.join(' ')} Choose one of: ${legal.join(
                  ', '
              )}.`
            : [where, opts.note].filter(Boolean).join(' ')

        const answer = (await ask('opponent', input, {
            signal: opts.signal,
            // A draft pick is lower-stakes than a commitment.
            tier: turn.phase === 'draft' ? 'fast' : 'default',
        })) as {card?: unknown; taunt?: unknown} | undefined

        const card = answer?.card
        if (!isElement(card)) {
            rejected.push(`${JSON.stringify(card)} is not a card.`)
            continue
        }
        if (!legal.includes(card)) {
            rejected.push(`${card} is not legal here.`)
            continue
        }

        // The sheet has the last word: between the read and here, nothing
        // should have moved, but committing is what proves it.
        await game.commit(card)
        return {
            card,
            taunt: typeof answer?.taunt === 'string' ? answer.taunt : undefined,
            tries,
        }
    }

    throw new AiRefused(
        `the AI did not pick a legal card in ${maxTries} tries: ${rejected.join(
            ' '
        )}`
    )
}
