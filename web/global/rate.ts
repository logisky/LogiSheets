const DEFAULT_PPI = 96
const PPI = DEFAULT_PPI
let MDW = 6
const MAX_MDW = 15
const MIN_MDW = 1
export function ptToPx(pt: number): number {
    // return pt * PPI / 96
    return pt * 96 / 72
}

export function pxToPt(px: number): number {
    return px * 96 / PPI
}

export function emToPt(em: number): number {
    return 12 * em
}

export function ptToEm(pt: number): number {
    return pt / 12
}

export function width2px(width: number): number {
    return Math.floor((width + (Math.round(128/MDW))/256)* MDW)
}

function px2char(px: number) {
    return (Math.floor((px - 5)/MDW * 100 + 0.5))/100
}

function char2width(chr: number) {
    return (Math.round((chr * MDW + 5)/MDW*256))/256
}

//function px2char_(px) { return (((px - 5)/MDW * 100 + 0.5))/100; }
//function char2width_(chr) { return (((chr * MDW + 5)/MDW*256))/256; }
function cycleWidth(collw: number) {
    return char2width(px2char(width2px(collw)))
}

/* XLSX/XLSB/XLS specify width in units of MDW */
export function findMdwColw(collw: number): void {
    let delta = Math.abs(collw - cycleWidth(collw))
    let mdw = MDW
    if(delta > 0.005)
        for(MDW=MIN_MDW; MDW<MAX_MDW; ++MDW)
            if(Math.abs(collw - cycleWidth(collw)) <= delta) {
                delta = Math.abs(collw - cycleWidth(collw))
                mdw = MDW
            }
    MDW = mdw
}
