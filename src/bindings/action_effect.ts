import type { CellId } from "./cell_id"
import type { Task } from "./task"

export interface ActionEffect { sheets: Array<number>, async_tasks: Array<Task>, dirtys: Array<[number, CellId]>, }