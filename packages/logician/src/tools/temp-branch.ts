/**
 * The scratch branch, and who owns it.
 *
 * The engine keeps exactly ONE temp branch per workbook (`Controller.
 * temp_status`). Everything about it is workbook-wide:
 *
 *   - a temp transaction opens the branch if none is open, and otherwise
 *     accumulates onto whatever is already there;
 *   - `cleanupTempStatus` discards the branch entirely — not "the part I
 *     wrote", the branch;
 *   - any NON-temp transaction silently discards it too (see
 *     `Controller::handle_action`).
 *
 * A dry run (`edit__preview_changes`) and a goal-seek probe both want a
 * private scratch space, and neither can have one: if the user is mid-way
 * through their own speculative session — the app's "Temp mode" chip, or a
 * craft that called `setTempMode` — then opening a branch writes into THEIR
 * branch and the tidy-up afterwards throws their work away. No prompt, no
 * undo entry, nothing to recover from.
 *
 * So a tool that wants the branch has to ask first, and step aside when it is
 * taken. That is what {@link withTempBranch} does. The alternative — silently
 * skipping the check — is what shipped, and it is the reason this module
 * exists.
 */

import {isErrorMessage} from 'logisheets-web/pure'
import type {Client} from 'logisheets-web/pure'

/**
 * Is a temp branch open on this workbook right now?
 *
 * Returns `undefined` when the client cannot answer — an older
 * `logisheets-web` that predates the `isInTempMode` RPC. Callers treat that
 * as "unknown" rather than "no": refusing every dry run on an old client
 * would be worse than the race it guards against, but the distinction is
 * worth keeping visible at the call site.
 */
export async function tempBranchIsOpen(
    client: Client
): Promise<boolean | undefined> {
    const probe = (client as Partial<Client>).isInTempMode
    if (typeof probe !== 'function') return undefined
    const res = await client.isInTempMode()
    if (isErrorMessage(res)) return undefined
    return res
}

/**
 * Refuse to run a committed (non-temp) write while somebody else's scratch
 * branch is open.
 *
 * This is not politeness. `Controller::handle_action` discards the temp branch
 * before applying any non-temp action, so an agent's `set_cells` landing in
 * the middle of a user's temp-mode session deletes that whole session — no
 * prompt, no undo entry, nothing to restore from. Every write tool calls this
 * first, so the model gets a refusal it can relay instead of the user losing
 * work they were in the middle of.
 */
export async function assertScratchBranchFree(
    client: Client,
    what: string
): Promise<void> {
    if ((await tempBranchIsOpen(client)) !== true) return
    throw new Error(
        `${what} was not run: the workbook has uncommitted scratch-branch ` +
            'edits (the user is in temp mode, or a craft opened a branch). ' +
            'A committed write discards that branch and everything on it, so ' +
            'nothing was written. Ask the user to commit or discard their ' +
            'temp-mode changes, then try again.'
    )
}

/**
 * Run `body` on a private scratch branch, then discard the branch.
 *
 * Refuses — before touching anything — when a branch is already open, because
 * the discard at the end would take the other owner's edits with it. The
 * thrown message is addressed to the model: it says what is in the way and
 * what would clear it, so the agent can relay that instead of retrying.
 *
 * `what` names the caller in errors (e.g. `'preview_changes'`).
 */
export async function withTempBranch<T>(
    client: Client,
    what: string,
    body: () => Promise<T>
): Promise<T> {
    if ((await tempBranchIsOpen(client)) === true) {
        throw new Error(
            `${what} needs the workbook's scratch branch, and it is already in ` +
                'use — the user is editing in temp mode, or a craft opened a ' +
                'branch. There is only one branch per workbook and discarding ' +
                'it would throw those edits away, so this tool will not touch ' +
                'it. Ask the user to commit or discard their temp-mode changes ' +
                'first, then run this again.'
        )
    }

    const toggled = await client.toggleStatus({useTemp: true})
    if (isErrorMessage(toggled)) {
        throw new Error(`toggleStatus failed: ${toggled.msg}`)
    }
    // The body's outcome is held rather than rethrown from a `finally`, so a
    // failing cleanup cannot swallow the error that explains the failure.
    let outcome: {ok: true; value: T} | {ok: false; error: unknown}
    try {
        outcome = {ok: true, value: await body()}
    } catch (error) {
        outcome = {ok: false, error}
    }

    // A cleanup that fails leaves the branch — and therefore whatever the body
    // wrote — as the live state, the exact opposite of what a dry run
    // promises. Swallowing the result is how that went unnoticed once already:
    // the engine's RPC was named `cleanTempStatus` while the client interface
    // said `cleanupTempStatus`, so on any host that forwards method names
    // verbatim the discard was a silent no-op and every dry run committed
    // itself.
    const cleaned = await client.cleanupTempStatus()
    if (isErrorMessage(cleaned)) {
        // Of the two failures this is the one the user has to hear about: the
        // other merely didn't finish, this one changed the workbook.
        const also = outcome.ok
            ? ''
            : ` The run itself also failed: ${errorText(outcome.error)}`
        throw new Error(
            `${what} could not discard its temp branch (${cleaned.msg}) — ` +
                `the workbook may now hold the values it wrote.${also}`
        )
    }

    if (!outcome.ok) throw outcome.error
    return outcome.value
}

function errorText(e: unknown): string {
    return e instanceof Error ? e.message : String(e)
}
