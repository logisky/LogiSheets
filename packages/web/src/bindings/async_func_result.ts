// DO NOT EDIT. CODE GENERATED BY gents.
import { Task } from './task'

// The results of the tasks which are passed to JS side to calculate previously.
export interface AsyncFuncResult {
    tasks: readonly Task[]
    // These strings can be numbers, strings and other things.
    // Note that now error types are hardcoded, which means if the
    // value is equal to the a specific string like `#TIMEOUT!`,
    // it is reagarded as an error.
    values: readonly string[]
}
