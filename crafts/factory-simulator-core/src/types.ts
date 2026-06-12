export interface Supplier {
    material: Material
    maxSupply: number
    yieldRate: number
    unitPrice: number
}

export interface Order {
    requiredAmount: number
    unitPrice: number
    requiredYieldRate: number
}

export enum Material {
    OpticalGlass,
    EquatorialMount,
    MetalFittings,
}

export interface ProductionLine {
    level: number
}

export interface ProductionLineMetrics {
    maxAmount: number
    fixedCost: number
}
