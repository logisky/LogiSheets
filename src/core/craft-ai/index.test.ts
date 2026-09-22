import {describe, it, expect, vi, beforeEach} from 'vitest'
import type {
    CraftManifest,
    InstalledCraftStore,
    WorkbookClient,
} from 'logisheets-logician'
import {craftIdFromSrc, makeCraftAi} from './index'

const askAi = vi.hoisted(() => vi.fn())
const llmConfigured = vi.hoisted(() => vi.fn(() => true))

vi.mock('logisheets-logician', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    askAi,
}))
vi.mock('@/components/watson/lib/llm-factory', () => ({
    llmConfigured,
    loadLlmSettings: () => ({
        provider: 'anthropic',
        model: 'claude-opus-5',
        apiKey: 'sk-test',
        baseUrl: '',
    }),
    makeLlmClient: () => ({createMessage: vi.fn()}),
}))

const MANIFEST: CraftManifest = {
    schemaVersion: 1,
    craftId: 'chess',
    version: '1.0.0',
    label: 'Chess',
    skill: {description: 'Play chess.'},
    tools: [
        {
            name: 'get_position',
            description: 'The position, as FEN.',
            inputSchema: {type: 'object', properties: {}},
            paramOrder: [],
            entry: 'tools.js',
            export: 'getPosition',
            mutates: 'none',
            confirmation: 'never',
        },
        {
            name: 'apply_move',
            description: 'Play a move.',
            inputSchema: {type: 'object', properties: {}},
            paramOrder: [],
            entry: 'tools.js',
            export: 'applyMove',
            mutates: true,
            confirmation: 'always',
        },
    ],
    roles: [
        {
            name: 'opponent',
            system: 'You play chess as Black.',
            replySchema: {
                type: 'object',
                properties: {uci: {type: 'string'}},
                required: ['uci'],
            },
            replyType: 'OpponentMove',
        },
    ],
}

function storeOf(m: CraftManifest | undefined): InstalledCraftStore {
    return {
        list: async () => [],
        get: async () => m,
        load: async () => ({}),
    }
}

function subject(
    m: CraftManifest | undefined = MANIFEST,
    consent = true,
    onBusy = vi.fn()
) {
    const requestConsent = vi.fn(async () => consent)
    const ai = makeCraftAi({
        craftId: 'chess',
        store: storeOf(m),
        workbook: {} as WorkbookClient,
        requestConsent,
        onBusy,
    })
    return {ai, requestConsent, onBusy}
}

beforeEach(() => {
    askAi.mockReset().mockResolvedValue({uci: 'g8f6'})
    llmConfigured.mockReset().mockReturnValue(true)
})

describe('craftIdFromSrc', () => {
    it('recovers the id from the panel URL the host keys crafts by', () => {
        expect(craftIdFromSrc('/lights-out/index.html')).toBe('lights-out')
        expect(craftIdFromSrc('/chess/index.html?lang=zh-CN')).toBe('chess')
        expect(craftIdFromSrc('chess')).toBe('chess')
    })
})

describe('available', () => {
    it('is ok for a craft with a role and a configured provider', async () => {
        await expect(subject().ai.available()).resolves.toEqual({ok: true})
    })

    it('says unsupported when the craft declares no role', async () => {
        const {ai} = subject({...MANIFEST, roles: []})
        await expect(ai.available()).resolves.toEqual({
            ok: false,
            reason: 'unsupported',
        })
    })

    it('says no-key before the user has configured a provider', async () => {
        llmConfigured.mockReturnValue(false)
        await expect(subject().ai.available()).resolves.toEqual({
            ok: false,
            reason: 'no-key',
        })
    })

    it('says denied once the user has refused', async () => {
        const {ai} = subject(MANIFEST, false)
        await ai.ask('opponent', 'Your move.').catch(() => {})
        await expect(ai.available()).resolves.toEqual({
            ok: false,
            reason: 'denied',
        })
    })
})

describe('ask', () => {
    it('runs the declared role and returns the answer', async () => {
        const {ai} = subject()
        await expect(ai.ask('opponent', 'Your move.')).resolves.toEqual({
            uci: 'g8f6',
        })
        const call = askAi.mock.calls[0][0]
        expect(call.role.system).toBe('You play chess as Black.')
        expect(call.input).toBe('Your move.')
    })

    it('gives the model the craft read tools and not the mutating one', async () => {
        const {ai} = subject()
        await ai.ask('opponent', 'Your move.')
        expect(
            askAi.mock.calls[0][0].tools.map((t: {name: string}) => t.name)
        ).toEqual(['get_position'])
    })

    it('names the roles the craft does have when asked for one it does not', async () => {
        const {ai} = subject()
        await expect(ai.ask('coach', 'Teach me.')).rejects.toThrow(
            /no @aiRole named "coach".*opponent/s
        )
        expect(askAi).not.toHaveBeenCalled()
    })

    it('asks for consent once, then remembers it', async () => {
        const {ai, requestConsent} = subject()
        await ai.ask('opponent', 'Your move.')
        await ai.ask('opponent', 'Your move.')
        expect(requestConsent).toHaveBeenCalledOnce()
        expect(askAi).toHaveBeenCalledTimes(2)
    })

    it('refuses without calling the model when consent is declined', async () => {
        const {ai} = subject(MANIFEST, false)
        await expect(ai.ask('opponent', 'Your move.')).rejects.toThrow(
            /has not allowed/
        )
        expect(askAi).not.toHaveBeenCalled()
    })

    it('refuses with a fixable message when no provider is configured', async () => {
        llmConfigured.mockReturnValue(false)
        const {ai} = subject()
        await expect(ai.ask('opponent', 'Your move.')).rejects.toThrow(
            /open the assistant panel and add a key/
        )
    })

    it('clears the busy indicator even when the ask fails', async () => {
        askAi.mockRejectedValue(new Error('model is down'))
        const {ai, onBusy} = subject()
        await expect(ai.ask('opponent', 'Your move.')).rejects.toThrow(
            'model is down'
        )
        expect(onBusy.mock.calls).toEqual([[true], [false]])
    })

    // The craft grades its own questions but never names a model — it cannot
    // know which provider the user configured. The host owns that mapping.
    it("runs a fast-tier ask on the provider's cheap model", async () => {
        askAi.mockResolvedValue({move: 'e4'})
        const {ai} = subject()
        await ai.ask('opponent', 'Draft round 1.', {tier: 'fast'})
        expect(askAi.mock.calls[0][0].model).toBe('claude-haiku-4-5')
    })

    it('runs a default-tier ask on the configured model', async () => {
        askAi.mockResolvedValue({move: 'e4'})
        const {ai} = subject()
        await ai.ask('opponent', 'Play, slot 1.', {tier: 'default'})
        await ai.ask('opponent', 'No tier given.')
        expect(askAi.mock.calls.map((c) => c[0].model)).toEqual([
            'claude-opus-5',
            'claude-opus-5',
        ])
    })
})
