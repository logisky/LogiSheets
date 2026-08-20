/**
 * Turning a rejected transaction into something the model can act on.
 *
 * The engine's error *codes* are a placeholder — every rejection is code 1 — so
 * `status code 1` told the caller nothing at all. From engine 1.12 the effect
 * carries `errorMessage`, the executor's own explanation ("sheet name already
 * exists: Sheet1", "Failed to fetch block by the block id: 999 in sheet 0"),
 * which is the difference between an agent correcting itself and an agent
 * retrying the same call.
 *
 * Typed structurally rather than against `ActionEffect` on purpose: this package
 * declares a `^` range on the engine, so it may well be running against a build
 * with no `errorMessage` field. Reading it optionally degrades to the old
 * message instead of failing to compile.
 */

/** The part of a transaction result this module needs. */
export interface RejectedEffect {
    status: {type: string; value: unknown}
    /** The engine's reason, when the build provides one. */
    errorMessage?: string
}

/**
 * Message for a rejected transaction: the engine's reason when it gave one,
 * and the bare code when it didn't.
 */
export function transactionFailure(label: string, effect: RejectedEffect): Error {
    const reason = effect.errorMessage?.trim()
    return new Error(
        reason !== undefined && reason !== ''
            ? `${label}: ${reason}`
            : `${label}: rejected by the engine (status code ${String(
                  effect.status.value
              )})`
    )
}
