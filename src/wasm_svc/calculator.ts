/* eslint-disable @typescript-eslint/no-use-before-define */

import {Subject} from 'rxjs'
import {AsyncFuncResult} from './jsvalues'
import {Task} from 'src/bindings'

export type Executor = (args: readonly string[]) => Promise<string | CalcException>
type FuncName = string

// Calculator is responsible for calculating the functions defined customly by users.
// Custom function is useful because of its ability of accessing the internet.
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
                const asyncFuncResult: AsyncFuncResult = {tasks: tasks.tasks,  values: res}
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
        public readonly tasks: readonly Task[],
    ) {}
}
