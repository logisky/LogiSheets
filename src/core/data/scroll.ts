import {injectable} from 'inversify'
import {getID} from '@/core/ioc/id'

@injectable()
export class ScrollPosition {
    readonly id = getID()
    /**
     * pixel of x-axis margin-left
     */
    public x = 0
    /**
     * pixel of y-axis magin-top
     */
    public y = 0
}
