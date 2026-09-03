import {describe, expect, it} from 'vitest'
import type {BlockModifyInfo} from 'logisheets-engine'
import {callerRegistry} from 'logisheets-core'
import {blockOpForPayload, declaresPolicy, isPersistedOwner} from './patch'

/** A block's governance metadata, with everything unstated by default. */
const info = (over: Partial<BlockModifyInfo> = {}): BlockModifyInfo =>
    ({
        owner: '',
        modifyPolicy: 'all',
        permissions: {},
        description: '',
        ...over,
    } as BlockModifyInfo)

describe('blockOpForPayload', () => {
    it('groups the payloads that resize a block', () => {
        for (const t of [
            'insertRowsInBlock',
            'deleteRowsInBlock',
            'insertColsInBlock',
            'deleteColsInBlock',
            'resizeBlock',
        ]) {
            expect(blockOpForPayload(t)).toBe('insertDeleteLines')
        }
    })

    it('keeps deleting the whole block separate from resizing it', () => {
        // Its own policy because it takes the records, the schema and the
        // policy itself with it.
        expect(blockOpForPayload('removeBlock')).toBe('removeBlock')
    })

    it('treats handing the policies over as a schema change', () => {
        // Otherwise a block could be unlocked simply by asking to.
        expect(blockOpForPayload('setBlockPermissions')).toBe('modifySchema')
        expect(blockOpForPayload('bindFormSchema')).toBe('modifySchema')
    })

    it('maps both write paths onto cellInput', () => {
        // The grid sends `cellInput` when a person types; crafts send
        // `blockInput`. One policy has to cover both.
        expect(blockOpForPayload('cellInput')).toBe('cellInput')
        expect(blockOpForPayload('blockInput')).toBe('cellInput')
    })

    it('maps reordering onto sortByField', () => {
        expect(blockOpForPayload('reorderBlockLines')).toBe('sortByField')
        expect(blockOpForPayload('moveBlockLine')).toBe('sortByField')
    })

    it('leaves moving a block ungoverned', () => {
        // A moved block keeps its identity, its cells and its rules, so it is
        // not the "block escapes its owner" case. Falls back to the older
        // owner check rather than becoming unguarded.
        expect(blockOpForPayload('moveBlock')).toBeUndefined()
        expect(blockOpForPayload('blockStyleUpdate')).toBeUndefined()
        expect(blockOpForPayload('cellStyleUpdate')).toBeUndefined()
    })
})

describe('declaresPolicy', () => {
    it('is false for a block that states nothing', () => {
        // The distinction that matters: "says anyone may" vs "says nothing".
        // A block created with an owner but no policy is the second, and must
        // keep the older owner check rather than reading as wide open.
        expect(declaresPolicy(info({owner: 'craft-a'}), 'cellInput')).toBe(
            false
        )
    })

    it('is true once the operation is singled out, even as `all`', () => {
        expect(
            declaresPolicy(info({permissions: {cellInput: 'all'}}), 'cellInput')
        ).toBe(true)
    })

    it('is true when the default policy is not simply "anyone"', () => {
        expect(
            declaresPolicy(info({modifyPolicy: 'ownerOnly'}), 'cellInput')
        ).toBe(true)
    })

    it('reads each operation on its own', () => {
        const i = info({permissions: {insertDeleteLines: 'ownerOnly'}})
        expect(declaresPolicy(i, 'insertDeleteLines')).toBe(true)
        expect(declaresPolicy(i, 'cellInput')).toBe(false)
    })

    it('is false when the engine could not answer', () => {
        expect(declaresPolicy(undefined, 'cellInput')).toBe(false)
    })
})

describe('isPersistedOwner', () => {
    it('matches the craft the block was saved as owned by', () => {
        // The saved owner is a craft id; the uuid is session-scoped, so the
        // two have to be bridged before they can be compared.
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
