/* eslint-disable @typescript-eslint/no-use-before-define */

import {Subject} from 'rxjs'
import {AsyncFuncResult, Task} from './jsvalues'

export type Executor = (args: readonly string[]) => Promise<string | CalcException>
type FuncName = string

export class Calculator {
    public constructor() {
        this.input$.subscribe(async (tasks): Promise<void> => {
            const promises = tasks.tasks.map(t => this.calc(t.asyncFunc, t.args))
            Promise.all(promises).then(values => {
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
                const asyncFuncResult: AsyncFuncResult = {asyncId: tasks.id, values: res}
                this.output$.next(asyncFuncResult)
            })
        })
    }

    public input$: Subject<Tasks> = new Subject()
    public output$: Subject<AsyncFuncResult> = new Subject()

    public async calc(
        func: FuncName,
        args: readonly string[],
    ): Promise<string | CalcException> {
        const executor = this._registry.get(func)
        if (executor === undefined) {
            return CalcException.NotFound
        }
        return executor(args)
    }

    public registry(funcName: string, executor: Executor) {
        this._registry.set(funcName, executor)
    }

    private _registry: Map<FuncName, Executor> = new Map()
}

export const enum CalcException {
    Unspecified,
    ArgErr,
    TimeOut,
    NotFound,
}

export class Tasks {
    public constructor(
        public readonly id: number,
        public readonly tasks: Task[],
    ) {}
}
