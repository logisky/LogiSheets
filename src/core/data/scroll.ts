import { shallowCopy } from "global"

export class ScrollPosition {
    static copy(scrollPosition: ScrollPosition) {
        const target = new ScrollPosition()
        shallowCopy(scrollPosition, target)
        return target
    }
    /**
     * pixel of x-axis margin-left
     */
    public x = 0
    /**
     * pixel of y-axis magin-top
     */
    public y = 0
}