import {AsyncFuncResult, Task} from '../bindings'

export const enum CalcException {
    Unspecified,
    ArgErr,
    TimeOut,
    NotFound,
}

export type Executor = (
    args: readonly string[]
) => Promise<string | CalcException>

export class CustomFunc {
    public constructor(
        public readonly funcName: string,
        public executor: Executor
    ) {}
}

type FuncName = string

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
