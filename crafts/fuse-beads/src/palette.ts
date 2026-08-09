// Official MARD (咪呀) fuse-bead palette — all 291 colors.
//
// Source: https://www.pixel-beads.com/mard-bead-color-chart
//
// Fuse beads (拼豆 / 熔珠, a.k.a. Hama / Perler / Nabbi beads) are sold by code,
// and MARD groups its chart by series letter (A, B, … ZG). We keep exactly that
// grouping: one tab per series letter. There aren't many letters, so the tab row
// stays short, and it matches how the printed chart (and the shop) is organized.

export interface Bead {
    /** Official MARD code, e.g. "A1", "ZG8". */
    code: string
    /** #RRGGBB fill color. */
    hex: string
    /** Series letter prefix, e.g. "A", "ZG". */
    series: string
    /** Numeric part of the code, for in-series ordering. */
    num: number
}

export interface BeadCategory {
    /** Stable key = series letter. */
    key: string
    /** Display label = series letter. */
    label: string
    beads: Bead[]
}

// All 291 official colors, as [code, hex]. Kept flat; grouped by hue below.
const RAW: ReadonlyArray<readonly [string, string]> = [
    // Series A
    ['A1', '#F9F0CD'], ['A2', '#FBFBD4'], ['A3', '#FAFC9F'], ['A4', '#FFE953'],
    ['A5', '#F4D738'], ['A6', '#FDAD49'], ['A7', '#FF7C2F'], ['A8', '#EACA49'],
    ['A9', '#FF995A'], ['A10', '#FF9D55'], ['A11', '#FFDD99'], ['A12', '#FCB58F'],
    ['A13', '#FFBB59'], ['A14', '#FF6D40'], ['A15', '#FDFF44'], ['A16', '#FEF9AE'],
    ['A17', '#FFE36E'], ['A18', '#FECF98'], ['A19', '#FD7B72'], ['A20', '#EFCD67'],
    ['A21', '#FFE395'], ['A22', '#FFF3A4'], ['A23', '#F3D5BF'], ['A24', '#FBF8C9'],
    ['A25', '#FFD67D'], ['A26', '#FFBB27'],
    // Series B
    ['B1', '#E6EE32'], ['B2', '#5BE419'], ['B3', '#7CEE9D'], ['B4', '#1EF942'],
    ['B5', '#00BD35'], ['B6', '#5AE8BA'], ['B7', '#03AC88'], ['B8', '#029D26'],
    ['B9', '#26523A'], ['B10', '#95D3C2'], ['B11', '#5D722A'], ['B12', '#156F40'],
    ['B13', '#D9F794'], ['B14', '#ADE945'], ['B15', '#2E5132'], ['B16', '#C6ED9C'],
    ['B17', '#9BB13A'], ['B18', '#E6EE49'], ['B19', '#25B88C'], ['B20', '#C2F0CC'],
    ['B21', '#146A6B'], ['B22', '#0B3C43'], ['B23', '#303921'], ['B24', '#EEFCA5'],
    ['B25', '#4E846D'], ['B26', '#8C7A36'], ['B27', '#D1DCC1'], ['B28', '#9EE5B9'],
    ['B29', '#C5E254'], ['B30', '#ECFBD0'], ['B31', '#C4E6B5'], ['B32', '#9BAB5A'],
    // Series C
    ['C1', '#E8FFE7'], ['C2', '#BCF9F6'], ['C3', '#A0E2FB'], ['C4', '#42CCFF'],
    ['C5', '#01ACEB'], ['C6', '#50A9F0'], ['C7', '#0188D3'], ['C8', '#1054C0'],
    ['C9', '#314BCA'], ['C10', '#3EBCE2'], ['C11', '#03B9B9'], ['C12', '#1C334D'],
    ['C13', '#CDE8FF'], ['C14', '#D5FDFF'], ['C15', '#23C4C6'], ['C16', '#1757A8'],
    ['C17', '#50D3EC'], ['C18', '#1C3344'], ['C19', '#1787A2'], ['C20', '#0082BE'],
    ['C21', '#BEDDFF'], ['C22', '#67B4BE'], ['C23', '#C2DCEB'], ['C24', '#7DC4FF'],
    ['C25', '#A9E5E5'], ['C26', '#2F99B3'], ['C27', '#EBF5FC'], ['C28', '#BBCFED'],
    ['C29', '#4B5BA3'],
    // Series D
    ['D1', '#AEB4F2'], ['D2', '#858EDD'], ['D3', '#3054AF'], ['D4', '#182A84'],
    ['D5', '#B843C5'], ['D6', '#AC7BDE'], ['D7', '#6E399A'], ['D8', '#E2D3FF'],
    ['D9', '#D5B9F8'], ['D10', '#361B50'], ['D11', '#B9BAE1'], ['D12', '#DE9AD4'],
    ['D13', '#B90295'], ['D14', '#8B279B'], ['D15', '#2F1F90'], ['D16', '#E2E1EE'],
    ['D17', '#C4D4F6'], ['D18', '#A45EC7'], ['D19', '#D8C3D7'], ['D20', '#9C32B2'],
    ['D21', '#9A009B'], ['D22', '#333995'], ['D23', '#EADAFC'], ['D24', '#7786E5'],
    ['D25', '#484FC7'], ['D26', '#E9C3F6'],
    // Series E
    ['E1', '#FDD3CC'], ['E2', '#FECDDF'], ['E3', '#FF97C3'], ['E4', '#E8649E'],
    ['E5', '#F551A2'], ['E6', '#FF346B'], ['E7', '#C63578'], ['E8', '#FFDBE9'],
    ['E9', '#E970CC'], ['E10', '#D33893'], ['E11', '#FCDDD2'], ['E12', '#FFA1C5'],
    ['E13', '#B6006D'], ['E14', '#FFD1BA'], ['E15', '#F2CFD0'], ['E16', '#FFECDE'],
    ['E17', '#FFE2EA'], ['E18', '#FFC9D6'], ['E19', '#FFD2E7'], ['E20', '#D8C7D1'],
    ['E21', '#BD9DA1'], ['E22', '#CC78A7'], ['E23', '#937A8D'], ['E24', '#F6E4F9'],
    // Series F
    ['F1', '#FD957B'], ['F2', '#FC3D45'], ['F3', '#F74941'], ['F4', '#FC283C'],
    ['F5', '#D80127'], ['F6', '#B0443D'], ['F7', '#971937'], ['F8', '#BC0127'],
    ['F9', '#E2677A'], ['F10', '#A74D22'], ['F11', '#6F201F'], ['F12', '#FD4D6A'],
    ['F13', '#DD422F'], ['F14', '#FFA9AD'], ['F15', '#C80020'], ['F16', '#FFD9C8'],
    ['F17', '#F79B71'], ['F18', '#D37C46'], ['F19', '#C1444A'], ['F20', '#CD9391'],
    ['F21', '#F4B1B4'], ['F22', '#FFD0CB'], ['F23', '#F57E66'], ['F24', '#FCC1C4'],
    ['F25', '#E54B4F'],
    // Series G
    ['G1', '#FFE2CE'], ['G2', '#FFCAAA'], ['G3', '#F4C3A5'], ['G4', '#E1B383'],
    ['G5', '#ED9435'], ['G6', '#F59734'], ['G7', '#9D5B3E'], ['G8', '#592A21'],
    ['G9', '#E6B483'], ['G10', '#C88135'], ['G11', '#E0C593'], ['G12', '#EBBB83'],
    ['G13', '#B7714A'], ['G14', '#8D614C'], ['G15', '#FCF9E0'], ['G16', '#F2D9BA'],
    ['G17', '#56403C'], ['G18', '#FFE4CC'], ['G19', '#E1943A'], ['G20', '#A94023'],
    ['G21', '#CB8E77'],
    // Series H (grays / white / black + a few neutrals)
    ['H1', '#E2E2E2'], ['H2', '#FFFFFF'], ['H3', '#B3B3B3'], ['H4', '#868686'],
    ['H5', '#474747'], ['H6', '#2C2C2C'], ['H7', '#000000'], ['H8', '#E7D6DB'],
    ['H9', '#E4E7E3'], ['H10', '#EEE9EA'], ['H11', '#CECDD5'], ['H12', '#FFF5ED'],
    ['H13', '#F3E1C9'], ['H14', '#CFD7D3'], ['H15', '#98A6A8'], ['H16', '#3B2F23'],
    ['H17', '#F1EDED'], ['H18', '#FFFDF0'], ['H19', '#F6EFE2'], ['H20', '#949FA3'],
    ['H21', '#F7F3E4'], ['H22', '#CACAD5'], ['H23', '#9A9D94'],
    // Series M (muted / dusty)
    ['M1', '#BCC6B8'], ['M2', '#8AA385'], ['M3', '#697D80'], ['M4', '#DACEBE'],
    ['M5', '#D0CCAA'], ['M6', '#B0A782'], ['M7', '#B4A497'], ['M8', '#B38281'],
    ['M9', '#A58767'], ['M10', '#C5B1BC'], ['M11', '#9F7494'], ['M12', '#644749'],
    ['M13', '#D19066'], ['M14', '#C77361'], ['M15', '#757D7B'],
    // Series P
    ['P1', '#FCF8F9'], ['P2', '#BDA9AB'], ['P3', '#AEDDA9'], ['P4', '#FDA49E'],
    ['P5', '#EC8D3D'], ['P6', '#60CFA8'], ['P7', '#EB9271'], ['P8', '#F0D958'],
    ['P9', '#D9D9D9'], ['P10', '#D5C8E9'], ['P11', '#F3ECC8'], ['P12', '#E6EEF1'],
    ['P13', '#A9CBF1'], ['P14', '#3177B0'], ['P15', '#668575'], ['P16', '#FFBE46'],
    ['P17', '#FFA324'], ['P18', '#FEB89F'], ['P19', '#FFE0E8'], ['P20', '#FEBECF'],
    ['P21', '#ECBEC0'], ['P22', '#E4A89E'], ['P23', '#A56269'],
    // Series Q
    ['Q1', '#F2A5E8'], ['Q2', '#73B29E'], ['Q3', '#FFFF00'], ['Q4', '#FFEBFA'],
    ['Q5', '#4F5E5B'],
    // Series R
    ['R1', '#D50E21'], ['R2', '#F92E83'], ['R3', '#FD8225'], ['R4', '#F8EC31'],
    ['R5', '#34C75B'], ['R6', '#25B891'], ['R7', '#17779D'], ['R8', '#1B60C3'],
    ['R9', '#9A56B4'], ['R10', '#FFDB4D'], ['R11', '#FFEBFA'], ['R12', '#D8D5CE'],
    ['R13', '#55514C'], ['R14', '#9EE4DF'], ['R15', '#77CEE9'], ['R16', '#3DCFCA'],
    ['R17', '#4A867A'], ['R18', '#7FCD9D'], ['R19', '#CDE55D'], ['R20', '#E8C7B4'],
    ['R21', '#AD6F3C'], ['R22', '#6C372F'], ['R23', '#FEB872'], ['R24', '#F2C1C0'],
    ['R25', '#C9675D'], ['R26', '#D293BE'], ['R27', '#EA8CB1'], ['R28', '#9C87D6'],
    // Series T
    ['T1', '#E2DFD7'],
    // Series Y (fluorescent)
    ['Y1', '#FD6FB4'], ['Y2', '#FEB481'], ['Y3', '#D7FAA0'], ['Y4', '#8BDBFA'],
    ['Y5', '#E987EA'],
    // Series ZG
    ['ZG1', '#DAABB3'], ['ZG2', '#D6AA87'], ['ZG3', '#C1BD8D'], ['ZG4', '#96869F'],
    ['ZG5', '#8490A6'], ['ZG6', '#94BFE2'], ['ZG7', '#E2A9D2'], ['ZG8', '#AB91C0'],
]

/** Split a code like "ZG8" into its series letters ("ZG") and number (8). */
function parseCode(code: string): {series: string; num: number} {
    const m = /^([A-Za-z]+)(\d+)$/.exec(code)
    return m ? {series: m[1], num: parseInt(m[2], 10)} : {series: code, num: 0}
}

/** Flat lookup by code, e.g. beadByCode("F5"). */
export const BEAD_BY_CODE: Record<string, Bead> = (() => {
    const m: Record<string, Bead> = {}
    for (const [code, hex] of RAW) {
        const {series, num} = parseCode(code)
        m[code] = {code, hex, series, num}
    }
    return m
})()

// Group by MARD series letter, one tab per series. Series appear in the order
// they first show up in RAW (A, B, … ZG); within a series, sort by number.
export const PALETTE: BeadCategory[] = (() => {
    const order: string[] = []
    const buckets = new Map<string, Bead[]>()
    for (const [code] of RAW) {
        const bead = BEAD_BY_CODE[code]
        if (!buckets.has(bead.series)) {
            buckets.set(bead.series, [])
            order.push(bead.series)
        }
        buckets.get(bead.series)!.push(bead)
    }
    return order.map((series) => ({
        key: series,
        label: series,
        beads: buckets.get(series)!.slice().sort((a, b) => a.num - b.num),
    }))
})()
