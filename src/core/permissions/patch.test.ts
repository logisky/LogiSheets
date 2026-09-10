import {beforeEach, describe, expect, it} from 'vitest'
import type {BlockModifyInfo, WorkbookClient} from 'logisheets-engine'
import {callerRegistry} from 'logisheets-core'
import {
    blockOpForPayload,
    isPersistedOwner,
    loadOpTable,
    resetOpTableForTest,
} from './patch'

/** A block's governance metadata, with everything unstated by default. */
const info = (over: Partial<BlockModifyInfo> = {}): BlockModifyInfo =>
    ({
        owner: '',
        modifyPolicy: 'all',
        permissions: {},
        description: '',
        ...over,
    } as BlockModifyInfo)

/**
 * `blockOpForPayload` and "does this block state a policy" used to be
 * reimplemented here, and the craft runtime and Watson each had their own
 * notion — which is how the same payload comes to be governed by different
 * rules depending on who sent it. Both are the engine's answers now, and the
 * rules themselves are tested there
 * (`the_engine_says_which_operation_a_payload_counts_as` and
 * `a_block_reports_whether_it_states_a_policy_at_all` in
 * crates/controller/src/api/test.rs).
 *
 * What is left to test here is the host's half: that it reads the engine's
 * table rather than carrying one, and that it can bridge a saved owner id back
 * to a session caller.
 */
describe('blockOpForPayload', () => {
    beforeEach(() => resetOpTableForTest())

    it('knows nothing until the engine has been asked', () => {
        // Deliberate: an empty answer means "not a governed payload", which
        // falls back to the owner check rather than to "anyone may".
        expect(blockOpForPayload('cellInput')).toBeUndefined()
    })

    it('answers from the table the engine gave it', async () => {
        const client = {
            getBlockOpForPayloads: async () => [
                {payloadType: 'cellInput', op: 'cellInput'},
                {payloadType: 'blockInput', op: 'cellInput'},
                {payloadType: 'removeBlock', op: 'removeBlock'},
            ],
        } as unknown as WorkbookClient

        await loadOpTable(client)
        expect(blockOpForPayload('cellInput')).toBe('cellInput')
        expect(blockOpForPayload('blockInput')).toBe('cellInput')
        expect(blockOpForPayload('removeBlock')).toBe('removeBlock')
        // Absent from the engine's table — not governed, not unguarded.
        expect(blockOpForPayload('moveBlock')).toBeUndefined()
    })

    it('asks once even when several payloads race for it', async () => {
        let calls = 0
        const client = {
            getBlockOpForPayloads: async () => {
                calls += 1
                return [{payloadType: 'cellInput', op: 'cellInput'}]
            },
        } as unknown as WorkbookClient

        await Promise.all([
            loadOpTable(client),
            loadOpTable(client),
            loadOpTable(client),
        ])
        expect(calls).toBe(1)
        expect(blockOpForPayload('cellInput')).toBe('cellInput')
    })

    it('leaves the table empty when the engine cannot answer', async () => {
        const client = {
            getBlockOpForPayloads: async () => ({msg: 'nope', ty: 0}),
        } as unknown as WorkbookClient
        await loadOpTable(client)
        expect(blockOpForPayload('cellInput')).toBeUndefined()
    })
})

describe('isPersistedOwner', () => {
    it('matches the craft the block was saved as owned by', () => {
        // The saved owner is a craft id; the uuid is session-scoped, so the
        // two have to be bridged before they can be compared. That bridge is
        // host state, which is why this one stays here.
        const uuid = callerRegistry.getCraftUuid('orders-craft')
        expect(isPersistedOwner(info({owner: 'orders-craft'}), uuid)).toBe(true)
        expect(isPersistedOwner(info({owner: 'other-craft'}), uuid)).toBe(false)
    })

    it('is never the user, whatever the block says', () => {
        const user = callerRegistry.getUserUuid()
        expect(isPersistedOwner(info({owner: 'orders-craft'}), user)).toBe(
            false
        )
    })

    it('is false for an unowned block', () => {
        const uuid = callerRegistry.getCraftUuid('orders-craft')
        expect(isPersistedOwner(info({owner: ''}), uuid)).toBe(false)
        expect(isPersistedOwner(undefined, uuid)).toBe(false)
    })
})
