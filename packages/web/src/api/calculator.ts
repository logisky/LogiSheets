import {AsyncFuncResult, Task} from '../bindings'

/** Why a custom function failed. Each becomes an error string in the cell:
 *  `#ARGERR!`, `#TIMEOUT!`, `#NOTFOUND!`, anything else `#UNKNOWN!`. */
export const enum CalcException {
    Unspecified,
    ArgErr,
    TimeOut,
    NotFound,
}

/** Implements a custom function: receives its arguments as strings and
 *  resolves the cell's result as a string, or a {@link CalcException}. */
export type Executor = (
    args: readonly string[]
) => Promise<string | CalcException>

/** A formula function implemented in JS. Register it with
 *  `Workbook.registryCustomFunc`; `funcName` is what formulas call. */
export class CustomFunc {
    public constructor(
        public readonly funcName: string,
        public executor: Executor
    ) {}
}

type FuncName = string

/**
 * Runs the async tasks an `ActionEffect` hands back for custom functions.
 * All tasks run concurrently; the result keeps the task order, which is what
 * the engine uses to match values to cells. An unregistered function yields
 * `#NOTFOUND!` rather than rejecting.
 */
export class Calculator {
    public async calc(tasks: readonly Task[]): Promise<AsyncFuncResult> {
        const promises = tasks.map((t) => this._exec(t.asyncFunc, t.args))
        return Promise.all(promises).then((values) => {
            const res = values.map((v): string => {
                if (typeof v === 'string') {
                    return v
                }
                switch (v) {
                    case CalcException.ArgErr:
                        return '#ARGERR!'
                    case CalcException.TimeOut:
                        return '#TIMEOUT!'
                    case CalcException.NotFound:
                        return '#NOTFOUND!'
                    default:
                        return '#UNKNOWN!'
                }
            })
            const asyncFuncResult: AsyncFuncResult = {
                tasks,
                values: res,
            }
            return asyncFuncResult
        })
    }

    public registry(f: CustomFunc) {
        this._registry.set(f.funcName, f.executor)
    }

    private async _exec(
        func: FuncName,
        args: readonly string[]
    ): Promise<string | CalcException> {
        const executor = this._registry.get(func)
        if (executor === undefined) {
            return CalcException.NotFound
        }
        return executor(args)
    }

    private _registry: Map<FuncName, Executor> = new Map()
}
