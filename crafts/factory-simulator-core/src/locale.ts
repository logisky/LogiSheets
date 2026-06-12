// Locale dictionary for every user-visible string written into the
// spreadsheet by the factory simulator. Engine.ts is wrapped in a
// `createEngine(locale)` factory that closes over an instance of this
// interface. Internal block-table reference names (e.g. "OrderStatus",
// "Constants", "SupplierAccumulator"), sheet names (ENGINE / MAIN), and
// enum-set ids stay hardcoded — those are identifiers, never displayed.

export interface Locale {
    // Supplier display names. These appear both as block-table row keys
    // and as cell text throughout the procurement panel.
    suppliers: {
        opticalGlass1: string
        opticalGlass2: string
        equatorialMount1: string
        equatorialMount2: string
        metalFittings1: string
        metalFittings2: string
    }
    // Field-name column headers. Every entry here is BOTH the displayed
    // header AND the identifier referenced inside formula template
    // strings (BLOCKREF("...", #FIELD("..."), "...")), so the same
    // locale value must be used at both sides.
    fields: {
        expectedYieldRate: string
        requiredYieldRate: string
        currentExpectedYieldRate: string
        deliveredYieldRate: string
        deliveryDeadline: string
        currentDelivery: string
        remainingDelivery: string
        currentRevenue: string
        unitPenalty: string
        currentPenalty: string
        currentQualityPenalty: string
        currentGoodwillChange: string
        requiredAmount: string
        unitCost: string
        unitPrice: string
        productionLine: string
        productionLine1: string
        productionLine2: string
        fixedCost: string
        maxProduction: string
        perUnitCost: string
        yieldAdjustment: string
        level: string
        willUpgrade: string
        upgradeCost: string
        accumulatedSupply: string
        researchCount: string
        jointResearch: string
        researchThreshold: string
        researchTier: string
        lastResearchRound: string
        baselineYield: string
        baselinePrice: string
        capacity: string
        totalCost: string
        orderId: string
        cash: string
        // ACCEPTED_ORDER_STATUS_TABLE fields with no dedicated constant
        deliveredAmount: string // 已交付数量
        remainingPeriods: string // 剩余期数
        periods: string // 期数
        acceptedRound: string // 接单回合
        isAccepted: string // 是否接受
        order: string // 订单 (FK column in OrderConfiguration)
        supplier: string // 供应商
        item: string // 项目 (left col of FinImpact/FinStatus)
        value: string // 值 (right col of FinImpact/FinStatus)
    }
    // Financial-impact bucket names + financial-status row keys.
    finance: {
        productionLine1Cost: string
        productionLine2Cost: string
        opticalGlassCost: string
        equatorialMountCost: string
        metalFittingsCost: string
        goodwillDelta: string
        orderRevenue: string
        orderPenalty: string
        qualityPenalty: string
        productionLine1Upgrade: string
        productionLine2Upgrade: string
        fund: string
        goodwill: string
    }
    // Engine-side Constants block bookkeeping keys.
    constKeys: {
        consecutiveLoss: string
        consecutiveNoGoodwill: string
        gameState: string
    }
    // Navigation buttons rolled up into the host UI.
    nav: {
        sales: string
        plant: string
        procurement: string
    }
    // Joint-research enum dropdown label + variants.
    research: {
        menuLabel: string
        precision: string
        cost: string
        balanced: string
        menuHint: string
    }
    // Order-profile labels surfaced in generated-order metadata.
    orderProfiles: {
        small: string
        normal: string
        rush: string
    }
    // Status strings written into cells when an order is fully done.
    status: {
        orderComplete: string
    }
    // Error / notification messages surfaced through notifyHost.
    errors: {
        // ${conflicts} is the comma-joined list of conflicting sheet names.
        sheetNameCollision: (conflicts: string) => string
        // ${over} is the multi-line list of "<key>: <cap> > <max>" entries.
        overCapacity: (over: string) => string
    }
}

export const zhLocale: Locale = {
    suppliers: {
        opticalGlass1: '晶河光材',
        opticalGlass2: '齐辉光学',
        equatorialMount1: '星整天仪',
        equatorialMount2: '小林精密',
        metalFittings1: '黑学材料',
        metalFittings2: '艾配金属',
    },
    fields: {
        expectedYieldRate: '预计良品率',
        requiredYieldRate: '良品率',
        currentExpectedYieldRate: '本期预计良品率',
        deliveredYieldRate: '已交付良品率',
        deliveryDeadline: '剩余交付期数',
        currentDelivery: '本期交付数',
        remainingDelivery: '剩余交付数',
        currentRevenue: '本期收入',
        unitPenalty: '单位违约金',
        currentPenalty: '本期罚款',
        currentQualityPenalty: '本期品质罚款',
        currentGoodwillChange: '本期商誉变化',
        requiredAmount: '数量',
        unitCost: '单位成本',
        unitPrice: '单价',
        productionLine: '生产线',
        productionLine1: '一',
        productionLine2: '二',
        fixedCost: '固定开销',
        maxProduction: '最大生产数',
        perUnitCost: '每件产品开销',
        yieldAdjustment: '良品率影响',
        level: '等级',
        willUpgrade: '是否升级',
        upgradeCost: '升级费用',
        accumulatedSupply: '累计数量',
        researchCount: '研发次数',
        jointResearch: '联合研发',
        researchThreshold: '阈值',
        researchTier: '阶段',
        lastResearchRound: '上次研发回合',
        baselineYield: '本期基础良品率',
        baselinePrice: '本期基础单价',
        capacity: '本期产能',
        totalCost: '所有成本',
        orderId: '订单编号',
        cash: '现金',
        deliveredAmount: '已交付数量',
        remainingPeriods: '剩余期数',
        periods: '期数',
        acceptedRound: '接单回合',
        isAccepted: '是否接受',
        order: '订单',
        supplier: '供应商',
        item: '项目',
        value: '值',
    },
    finance: {
        productionLine1Cost: '生产线一支出',
        productionLine2Cost: '生产线二支出',
        opticalGlassCost: '光学玻璃支出',
        equatorialMountCost: '赤道仪支出',
        metalFittingsCost: '金属配件支出',
        goodwillDelta: '商誉变化',
        orderRevenue: '订单收入',
        orderPenalty: '订单罚款',
        qualityPenalty: '品质罚款',
        productionLine1Upgrade: '生产线一升级',
        productionLine2Upgrade: '生产线二升级',
        fund: '资金',
        goodwill: '商誉',
    },
    constKeys: {
        consecutiveLoss: '连续亏损轮数',
        consecutiveNoGoodwill: '连续零商誉轮数',
        gameState: '游戏状态',
    },
    nav: {
        sales: '销售部',
        plant: '工厂',
        procurement: '采购部',
    },
    research: {
        menuLabel: '联合研发项目',
        precision: '精度强化',
        cost: '成本压缩',
        balanced: '均衡研发',
        menuHint:
            "Pick one per R&D tier. Each option permanently shifts the supplier's 良品率 and 单价.",
    },
    orderProfiles: {
        small: '小单',
        normal: '常规',
        rush: '急单',
    },
    status: {
        orderComplete: '订单已完成',
    },
    errors: {
        sheetNameCollision: (conflicts) =>
            `新游戏无法开始：以下工作表名称已存在 — ${conflicts}。请重命名或删除这些工作表后再试。`,
        overCapacity: (over) =>
            `产能超限，无法进入下一轮：\n  · ${over}\n请减少生产线一/生产线二列的订单分配，或升级生产线。`,
    },
}

export const enLocale: Locale = {
    suppliers: {
        opticalGlass1: 'CrystalRiver',
        opticalGlass2: 'Zenith',
        equatorialMount1: 'StellarMount',
        equatorialMount2: 'Kobayashi',
        metalFittings1: 'BlackOre',
        metalFittings2: 'AlloyFit',
    },
    fields: {
        expectedYieldRate: 'Exp. Yield',
        requiredYieldRate: 'Yield Rate',
        currentExpectedYieldRate: 'Round Exp. Yield',
        deliveredYieldRate: 'Delivered Yield',
        deliveryDeadline: 'Rounds Left',
        currentDelivery: 'Deliver This Round',
        remainingDelivery: 'Remaining Delivery',
        currentRevenue: 'Round Revenue',
        unitPenalty: 'Penalty/Unit',
        currentPenalty: 'Round Penalty',
        currentQualityPenalty: 'Round Qual. Penalty',
        currentGoodwillChange: 'Goodwill Δ',
        requiredAmount: 'Amount',
        unitCost: 'Unit Cost',
        unitPrice: 'Unit Price',
        productionLine: 'Line',
        productionLine1: 'Line 1',
        productionLine2: 'Line 2',
        fixedCost: 'Fixed Cost',
        maxProduction: 'Max Production',
        perUnitCost: 'Cost/Unit',
        yieldAdjustment: 'Yield Adjustment',
        level: 'Level',
        willUpgrade: 'Upgrade?',
        upgradeCost: 'Upgrade Cost',
        accumulatedSupply: 'Total Supplied',
        researchCount: 'Research Count',
        jointResearch: 'Joint R&D',
        researchThreshold: 'Threshold',
        researchTier: 'Tier',
        lastResearchRound: 'Last R&D',
        baselineYield: 'Base Yield',
        baselinePrice: 'Base Price',
        capacity: 'Capacity',
        totalCost: 'Total Cost',
        orderId: 'Order ID',
        cash: 'Cash',
        deliveredAmount: 'Delivered',
        remainingPeriods: 'Periods Left',
        periods: 'Periods',
        acceptedRound: 'Accepted Round',
        isAccepted: 'Accept?',
        order: 'Order',
        supplier: 'Supplier',
        item: 'Item',
        value: 'Value',
    },
    finance: {
        productionLine1Cost: 'Line 1 Cost',
        productionLine2Cost: 'Line 2 Cost',
        opticalGlassCost: 'Glass Cost',
        equatorialMountCost: 'Mount Cost',
        metalFittingsCost: 'Fittings Cost',
        goodwillDelta: 'Goodwill Δ',
        orderRevenue: 'Revenue',
        orderPenalty: 'Penalty',
        qualityPenalty: 'Qual. Penalty',
        productionLine1Upgrade: 'Line 1 Upgrade',
        productionLine2Upgrade: 'Line 2 Upgrade',
        fund: 'Cash',
        goodwill: 'Goodwill',
    },
    constKeys: {
        consecutiveLoss: 'Loss Streak',
        consecutiveNoGoodwill: 'Zero-Rep Streak',
        gameState: 'Game State',
    },
    nav: {
        sales: 'Sales',
        plant: 'Plant',
        procurement: 'Procurement',
    },
    research: {
        menuLabel: 'R&D Project',
        precision: 'Precision Boost',
        cost: 'Cost Compression',
        balanced: 'Balanced R&D',
        menuHint:
            "Pick one per R&D tier. Each option permanently shifts the supplier's yield rate and unit price.",
    },
    orderProfiles: {
        small: 'Small',
        normal: 'Standard',
        rush: 'Rush',
    },
    status: {
        orderComplete: 'Order Complete',
    },
    errors: {
        sheetNameCollision: (conflicts) =>
            `Cannot start a new game: the following sheet names already exist — ${conflicts}. Rename or delete those sheets and try again.`,
        overCapacity: (over) =>
            `Capacity exceeded, cannot advance to next round:\n  · ${over}\nReduce order allocation in the Line 1 / Line 2 columns, or upgrade a production line.`,
    },
}
