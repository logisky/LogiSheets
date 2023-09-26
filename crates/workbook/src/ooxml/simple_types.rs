use xmlserde::xml_serde_enum;

xml_serde_enum! {
    #[derive(Debug, Clone, PartialEq, Eq)]
    StAxis {
        AxisRow => "axisRow",
        AxisCol => "axisCol",
        AxisPage => "axisPage",
        AxisValues => "axisValues",
    }
}

pub type StBorderId = u32;

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq, Hash, Clone, serde::Serialize)]
    #[cfg_attr(feature = "gents", derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents", ts(file_name="st_border_style.ts"))]
    StBorderStyle {
        None => "none",
        Thin => "thin",
        Medium => "medium",
        Dashed => "dashed",
        Dotted => "dotted",
        Thick => "thick",
        Double => "double",
        Hair => "hair",
        MediumDashed => "mediumDashed",
        DashDot => "dashDot",
        MediumDashDot => "mediumDashDot",
        DashDotDot => "dashDotDot",
        MediumDashDotDot => "mediumDashDotDot",
        SlantDashDot => "slantDashDot",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StCalcMode {
        Manual => "manual",
        Auto => "auto",
        AutoNoTable => "autoNoTable",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StCellComments {
        None => "none",
        AsDisplayed => "asDisplayed",
        AtEnd => "atEnd",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StCellFormulaType {
        Array => "array",
        DataTable => "dataTable",
        Normal => "normal",
        Shared => "shared",
    }
}

pub type StCellRef = String;

pub type StCellSpan = String;

pub type StCellSpans = Vec<StCellSpan>;

pub type StCellStyleXfId = u32;

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StCellType {
        B => "b",
        D => "d",
        N => "n",
        E => "e",
        S => "s",
        Str => "str",
        InlineStr => "inlineStr",
    }
}

xml_serde_enum! {
    /// 18.18.12
    #[derive(Debug, PartialEq, Eq)]
    StCfType {
        Expression => "expression",
        CellIs => "cellIs",
        ColorScale => "colorScale",
        DataBar => "dataBar",
        IconSet => "iconSet",
        Top10 => "top10",
        UniqueValues => "uniqueValues",
        DuplicateValues => "duplicateValues",
        ContainsText => "containsText",
        BeginsWith => "beginsWith",
        EndsWith => "endsWith",
        ContainsBlank => "containsBlank",
        NotContainsBlanks => "notContainsBlanks",
        ContainErrors => "containErrors",
        NotContainErrors => "notContainErrors",
        TimePeriod => "timePeriod",
        AboveAverage => "aboveAverage",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StCfvoType {
        Num => "num",
        Percent => "percent",
        Max => "max",
        Min => "min",
        Formula => "formula",
        Percentile => "percentile",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StComments {
        CommNone => "commNone",
        CommIndicator => "commIndicator",
        CommIndAndComment => "commIndAndComment",
    }
}

xml_serde_enum! {
    /// 18.18.15
    #[derive(Debug, PartialEq, Eq)]
    StConditionalFormattingOperator {
        LessThan => "lessThan",
        LessThanOrEqual => "lessThanOrEqual",
        Equal => "equal",
        NotEqual => "notEqual",
        GreaterThanOrEqual => "greaterThanOrEqual",
        GreaterThan => "greaterThan",
        Between => "between",
        NotBetween => "notBetween",
        ContainsText => "containsText",
        NotContains => "notContains",
        BeginsWith => "beginsWith",
        EndsWith => "endsWith",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StCredMethod {
        Integrated => "integrated",
        None => "none",
        Stored => "stored",
        Prompt => "prompt",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDataConsolidateFunction {
        Average => "average",
        Count => "count",
        CountNums => "countNums",
        Max => "max",
        Min => "min",
        Product => "product",
        StdDev => "stdDev",
        StdDevp => "stdDevp",
        Sum => "sum",
        Var => "var",
        Varp => "varp",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDataValidationErrorStyle {
        Stop => "stop",
        Warning => "warning",
        Information => "information",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDataValidationImeMode {
        NoControl => "noControl",
        Off => "off",
        On => "on",
        Disabled => "disabled",
        Hiragara => "hiragara",
        FullKatakana => "fullKatakana",
        HalfKatakana => "halfKatakana",
        FullAlpha => "fullAlpha",
        FullHangul => "fullHangul",
        HalfHangul => "halfHangul",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDataValidationOperator {
        Between => "between",
        NotBetween => "notBetween",
        Equal => "equal",
        NotEqual => "notEqual",
        LessThan => "lessThan",
        LessThanOrEqual => "lessThanOrEqual",
        GreaterThan => "greaterThan",
        GreaterThanOrEqual => "greaterThanOrEqual",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDataValidationType {
        None => "none",
        Whole => "whole",
        Decimal => "decimal",
        List => "list",
        Date => "date",
        Time => "time",
        TextLength => "textLength",
        Custom => "custom",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDateTimeGrouping {
        Year => "year",
        Month => "month",
        Day => "day",
        Hour => "hour",
        Minute => "minute",
        Second => "second",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDdeValueType {
        Nil => "nil",
        B => "b",
        N => "n",
        E => "e",
        Str => "str",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StDvAspect {
        DvaspectContent => "DVASPECT_CONTENT",
        DvaspectIcon => "DVASPECT_ICON",
    }
}

pub type StDxfId = u32;

xml_serde_enum! {
    /// 18.18.26
    #[derive(Debug, PartialEq, Eq)]
    StDynamicFilterType {
        Null => "null",
        AboveAverage => "aboveAverage",
        BelowAverage => "belowAverage",
        Tommorow => "tommorow",
        Today => "today",
        Yesterday => "yesterday",
        NextWeek => "nextWeek",
        ThisWeek => "thisWeek",
        LastWeek => "lastWeek",
        NextMonth => "nextMonth",
        ThisMonth => "thisMonth",
        LastMonth => "lastMonth",
        NextQuarter => "nextQuarter",
        ThisQuarter => "thisQuarter",
        LastQuarter => "lastQuarter",
        NextYear => "nextYear",
        ThisYear => "thisYear",
        LastYear => "lastYear",
        YearToDate => "yearToDate",
        Q1 => "Q1",
        Q2 => "Q2",
        Q3 => "Q3",
        Q4 => "Q4",
        M1 => "M1",
        M2 => "M2",
        M3 => "M3",
        M4 => "M4",
        M5 => "M5",
        M6 => "M6",
        M7 => "M7",
        M8 => "M8",
        M9 => "M9",
        M10 => "M10",
        M11 => "M11",
        M12 => "M12",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StExternalConnectionType {
        General => "general",
        Text => "text",
        MDY => "MDY",
        YMD => "YMD",
        MYD => "MYD",
        DYM => "DYM",
        YDM => "YDM",
        Skip => "skip",
        EMD => "EMD",
    }
}

xml_serde_enum! {
    /// 18.18.28
    #[derive(Debug, PartialEq, Eq)]
    StFieldSortType {
        Manual => "manual",
        Ascending => "ascending",
        Descending => "descending",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StFileType {
        DOS => "dos",
        Linux => "lin",
        Mac => "mac",
        Other => "other",
    }
}

pub type StFillId = u32;

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StFilterOperator {
        Equal => "equal",
        LessThan => "lessThan",
        LessThanOrEqual => "lessThanOrEqual",
        NotEqual => "notEqual",
        GreaterThanOrEqual => "greaterThanOrEqual",
        GreaterThan => "greaterThan",
    }
}

pub type StFontId = u32;

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq, Hash, Clone, serde::Serialize)]
    #[cfg_attr(feature = "gents",derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents",ts(file_name="st_font_scheme.ts"))]
    StFontScheme {
        None => "none",
        Major => "major",
        Minor => "minor",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StFormatAction {
        Blank => "blank",
        Formatting => "formatting",
        Drill => "drill",
        Formula => "formula",
    }
}

pub type StFormula = String;

xml_serde_enum! {
    /// 18.18.36
    #[derive(Debug, PartialEq, Eq)]
    StFormulaExpression {
        Ref => "ref",
        RefError => "refError",
        Area => "area",
        AreaError => "areaError",
        ComputedArea => "computedArea",
    }
}

xml_serde_enum! {
    /// 18.18.37
    #[derive(Debug, PartialEq, Eq, Clone, Hash, serde::Serialize)]
    #[cfg_attr(feature = "gents",derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents",ts(file_name="st_gradient_type.ts"))]
    StGradientType {
        Linear => "linear",
        Path => "path",
    }
}

xml_serde_enum! {
    /// 18.18.38
    #[derive(Debug, PartialEq, Eq)]
    StGroupBy {
        Range => "range",
        Seconds => "seconds",
        Minutes => "minutes",
        Hours => "hours",
        Days => "days",
        Months => "months",
        Quarters => "quarters",
        Years => "years",
    }
}

xml_serde_enum! {
    /// 18.18.39
    #[derive(Debug, PartialEq, Eq)]
    StGrowShrinkType {
        InsertDelete => "insertDelete",
        InsertClear => "insertClear",
        OverWriteClear => "overWriteClear",
    }
}

xml_serde_enum! {
    /// 18.18.40
    #[derive(Debug, PartialEq, Eq, Hash, Clone, serde::Serialize)]
    #[cfg_attr(feature = "gents",derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents",ts(file_name="st_horizontal_alignment.ts"))]
    StHorizontalAlignment {
        General => "general",
        Left => "left",
        Center => "center",
        Right => "right",
        Fill => "fill",
        Justify => "justify",
        CenterContinuous => "centerContinuous",
        Distributed => "distributed",
    }
}

xml_serde_enum! {
    /// 18.18.41
    #[derive(Debug, PartialEq, Eq)]
    StHtmlFmt {
        None => "none",
        Rtf => "rtf",
        All => "all",
    }
}

xml_serde_enum! {
    /// 18.18.42
    #[derive(Debug, PartialEq, Eq)]
    StIconSetType {
        ThreeArrows => "3Arrows",
        ThreeArrowsGray => "3ArrowsGray",
        ThreeFlags => "3Flags",
        ThreeTrafficLights1 => "3TrafficLights1",
        ThreeTrafficLights2 => "3TrafficLights2",
        ThreeSigns => "3Signs",
        ThreeSymbols => "3Symbols",
        ThreeSymbols2 => "3Symbols2",
        FourArrows => "4Arrows",
        FourArrowsGray => "4ArrowsGray",
        FourRedToBlack => "4RedToBlack",
        FourRating => "4Rating",
        FourTrafficLights => "4TrafficLights",
        FiveArrows => "5Arrows",
        FiveArrowsGray => "5ArrowsGray",
        FiveRating=> "5Rating",
        FiveQuarters => "5Quarters",
    }
}

xml_serde_enum! {
    /// 18.18.43
    #[derive(Debug, PartialEq, Eq)]
    StItemType {
        Data => "data",
        Default => "default",
        Sum => "sum",
        CountA => "countA",
        Avg => "avg",
        Max => "max",
        Min => "min",
        Product => "product",
        Count => "count",
        StdDev => "stdDev",
        StdDevP => "stdDevP",
        Var => "var",
        Grand => "grand",
        Blank => "blank",
    }
}

xml_serde_enum! {
    /// 18.18.44
    #[derive(Debug, PartialEq, Eq)]
    StMdxFunctionType {
        M => "m",
        V => "v",
        S => "s",
        C => "c",
        R => "r",
        P => "p",
        K => "k",
    }
}

xml_serde_enum! {
    /// 18.18.45
    #[derive(Debug, PartialEq, Eq)]
    StMdxKpiProperty {
        V => "v",
        G => "g",
        S => "s",
        T => "t",
        W => "w",
        M => "m",
    }
}

xml_serde_enum! {
    /// 18.18.46
    #[derive(Debug, PartialEq, Eq)]
    StMdxSetOrder {
        U => "u",
        A => "a",
        D => "d",
        Aa => "aa",
        Ad => "ad",
        Na => "na",
        Nd => "nd",
    }
}

pub type StNumFmtId = u32;

xml_serde_enum! {
    /// 18.18.48
    #[derive(Debug, PartialEq, Eq)]
    StObjects {
        All => "all",
        Placeholders => "placeholders",
        None => "none",
    }
}

xml_serde_enum! {
    /// 18.18.49
    #[derive(Debug, PartialEq, Eq)]
    StOleUpdate {
        OleupdateAlways => "OLEUPDATE_ALWAYS",
        OleupdateOncall => "OLEUPDATE_ONCALL",
    }
}

xml_serde_enum! {
    /// 18.18.50
    #[derive(Debug, PartialEq, Eq)]
    StOrientation {
        Default => "default",
        Portrait => "portrait",
        Landscape => "landscape",
    }
}

xml_serde_enum! {
    /// 18.18.51
    #[derive(Debug, PartialEq, Eq)]
    StPageOrder {
        DownThenOver => "downThenOver",
        OverThenDown => "overThenDown",
    }
}

xml_serde_enum! {
    /// 18.18.52
    #[derive(Debug, Clone, PartialEq, Eq)]
    StPane {
        BottomRight => "bottomRight",
        TopRight => "topRight",
        BottomLeft => "bottomLeft",
        TopLeft => "topLeft",
    }
}

xml_serde_enum! {
    /// 18.18.53
    #[derive(Debug, Clone, PartialEq, Eq)]
    StPaneState {
        Split => "split",
        Frozen => "frozen",
        FrozenSplit => "frozenSplit",
    }
}

xml_serde_enum! {
    /// 18.18.54
    #[derive(Debug, PartialEq, Eq)]
    StParameterType {
        Prompt => "prompt",
        Value => "value",
        Cell => "celll",
    }
}

xml_serde_enum! {
    /// 18.18.55
    #[derive(Debug, PartialEq, Eq, Clone, Hash, serde::Serialize)]
    #[cfg_attr(feature = "gents",derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents",ts(file_name="st_pattern_type.ts"))]
    StPatternType {
        None => "none",
        Solid => "solid",
        MediumGray => "mediumGray",
        DarkGray => "darkGray",
        LightGray => "lightGray",
        DarkHorizontal => "darkHorizontal",
        DarkVertical => "darkVertical",
        DarkDown => "darkDown",
        DarkUp => "darkUp",
        DarkGrid => "darkGrid",
        DarkTrellis => "darkTrellis",
        LightHorizontal => "lightHorizontal",
        LightVertical => "lightVertical",
        LightDown => "lightDown",
        LightUp => "lightUp",
        LightGrid => "lightGrid",
        LightTrellis => "lightTrellis",
        Gray125 => "gray125",
        Gray0625 => "gray0625",
    }
}

xml_serde_enum! {
    /// 18.18.56
    #[derive(Debug, PartialEq, Eq, Clone)]
    StPhoneticAlignment {
        Left => "left",
        Center => "center",
        Distributed => "distributed",
    }
}

xml_serde_enum! {
    /// 18.18.57
    #[derive(Debug, PartialEq, Eq, Clone)]
    StPhoneticType {
        HalfWidthKatakana => "halfwidthKatakana",
        FullwidthKatakana => "fullwidthKatakana",
        Hiragana => "hiragana",
        NoConversion => "noConversion",
    }
}

xml_serde_enum! {
    /// 18.18.58
    #[derive(Debug, Clone, PartialEq, Eq)]
    StPivotAreaType {
        None => "none",
        Normal => "normal",
        Data => "data",
        All => "all",
        Origin => "origin",
        Button => "button",
        TopEnd => "topEnd",
    }
}

xml_serde_enum! {
    /// 18.18.59
    #[derive(Debug, PartialEq, Eq)]
    StPivotFilterType {
        Unknown => "unknown",
        Count => "count",
        Percent => "percent",
        Sum => "sum",
        CaptionEqual => "captionEqual",
        CaptionNotEqual => "captionNotEqual",
        CaptionBeginsWith  => "captionBeginsWith",
        CaptionNotBeginsWith => "captionNotBeginsWith",
        CaptionEndsWith => "captionEndsWith",
        CaptionNotEndsWith => "captionNotEndsWith",
        CaptionContains => "captionContains",
        CaptionNotContains=> "captionNotContains",
        CaptionGreaterThan => "captionGreaterThan",
        CaptionGreaterThanOrEqual => "captionGreaterThanOrEqual",
        CaptionLessThan => "captionLessThan",
        CaptionLessThanOrEqual => "captionLessThanOrEqual",
        CaptionBetween => "captionBetween",
        CaptionNotBetween => "captionNotBetween",
        ValueEqual => "valueEqual",
        ValueNotEqual => "valueNotEqual",
        ValueGreaterThan => "valueGreaterThan",
        ValueGreaterThanOrEqual => "valueGreaterThanOrEqual",
        ValueLessThan => "valueLessThan",
        ValueLessThanOrEqual => "valueLessThanOrEqual",
        ValueBetween => "valueBetween",
        ValueNotBetween => "valueNotBetween",
        DateEqual => "dateEqual",
        DateNotEqual => "dateNotEqual",
        DateOlderThan => "dateOlderThan",
        DateOlderThanOrEqual => "dateOlderThanOrEqual",
        DateNewerThan => "dateNewerThan",
        DateNewerThanOrEqual => "dateNewerThanOrEqual",
        DateBetween => "dateBetween",
        DateNotBetween => "dateNotBetween",
        Tomorrow => "tomorrow",
        Today => "today",
        Yesterday => "yesterday",
        NextWeek => "nextWeek",
        ThisWeek => "thisWeek",
        LastWeek => "lastWeek",
        NextMonth => "nextMonth",
        ThisMonth => "thisMonth",
        LastMonth => "lastMonth",
        NextQuarter => "nextQuarter",
        ThisQuarter => "thisQuarter",
        LastQuarter => "lastQuarter",
        NextYear => "nextYear",
        ThisYear => "thisYear",
        LastYear => "lastYear",
        YearToDate => "yearToDate",
        Q1 => "Q1",
        Q2 => "Q2",
        Q3 => "Q3",
        Q4 => "Q4",
        M1 => "M1",
        M2 => "M2",
        M3 => "M3",
        M4 => "M4",
        M5 => "M5",
        M6 => "M6",
        M7 => "M7",
        M8 => "M8",
        M9 => "M9",
        M10 => "M10",
        M11 => "M11",
        M12 => "M12",
    }
}

xml_serde_enum! {
    /// 18.18.60
    #[derive(Debug, PartialEq, Eq)]
    StPrintError {
        Displayed => "displayed",
        Blank => "blank",
        Dash => "dash",
        Na => "NA",
    }
}

xml_serde_enum! {
    /// 18.18.61
    #[derive(Debug, PartialEq, Eq)]
    StQualifier {
        DoubleQuote => "doubleQuote",
        SingleQuote => "singleQuote",
        None => "none",
    }
}

pub type StRef = String;
pub type StRefA = String;

xml_serde_enum! {
    /// 18.18.64
    #[derive(Debug, PartialEq, Eq)]
    StRefMode {
        A1 => "A1",
        R1C1 => "R1C1",
    }
}

xml_serde_enum! {
    /// 18.18.65
    #[derive(Debug, PartialEq, Eq)]
    StRevisionAction {
        Add => "add",
        Delete => "delete",
    }
}

xml_serde_enum! {
    /// 18.18.66
    #[derive(Debug, PartialEq, Eq)]
    StRwColActionType {
        InsertRow => "insertRow",
        DeleteRow => "deleteRow",
        InsertCol => "insertCol",
        DeleteCol => "deleteCol",
    }
}

xml_serde_enum! {
    /// 18.18.67
    #[derive(Debug, PartialEq, Eq)]
    StScope {
        Selection => "selection",
        Data => "data",
        Field => "field",
    }
}

xml_serde_enum! {
    /// 18.18.68
    #[derive(Debug, PartialEq, Eq)]
    StSheetState {
        Visible => "visible",
        Hidden => "hidden",
        VeryHidden => "veryHidden",
    }
}

xml_serde_enum! {
    /// 18.18.69
    #[derive(Debug, Clone, PartialEq, Eq)]
    StSheetViewType {
        Normal => "normal",
        PageBreakPreview => "pageBreakPreview",
        PageLayout => "pageLayout",
    }
}

xml_serde_enum! {
    /// 18.18.70
    #[derive(Debug, PartialEq, Eq)]
    StShowDataAs {
        Normal => "normal",
        Difference => "difference",
        Percent => "percent",
        PercentDiff => "percentDiff",
        RunTotal => "runTotal",
        PercentOfRow => "percentOfRow",
        PercentOfCol => "percentOfCol",
        PercentOfTotal => "percentOfTotal",
        Index => "index",
    }
}

xml_serde_enum! {
    /// 18.18.71
    #[derive(Debug, PartialEq, Eq)]
    StSmartTagShow {
        All => "all",
        None => "none",
        NoIndicator => "noIndicator",
    }
}

xml_serde_enum! {
    /// 18.18.72
    #[derive(Debug, PartialEq, Eq)]
    StSortBy {
        Value => "value",
        CellColor => "cellColor",
        FontColor => "fontColor",
        Icon => "icon",
    }
}

xml_serde_enum! {
    /// 18.18.73
    #[derive(Debug, PartialEq, Eq)]
    StSortMethod {
        Stroke => "stroke",
        PinYin => "pinYin",
        None => "none",
    }
}

xml_serde_enum! {
    /// 18.18.74
    #[derive(Debug, PartialEq, Eq)]
    StSortType {
        None => "none",
        Ascending => "ascending",
        Descending => "descending",
        AscendingAlpha => "ascendingAlpha",
        DescendingAlpha => "descendingAplpha",
        AscendingNatural => "ascendingNatural",
        DescendingNatural => "descendingNatural",
    }
}

xml_serde_enum! {
    /// 18.18.75
    #[derive(Debug, PartialEq, Eq)]
    StSourceType {
        Worksheet => "worksheet",
        External => "external",
        Consolidation => "consolidation",
        Scenario => "scenario",
    }
}

pub type StSqref = Vec<StRef>;

xml_serde_enum! {
    /// 18.18.77
    #[derive(Debug, PartialEq, Eq)]
    StTableStyleType {
       WholeTable => "wholeTable",
       HeaderRow => "headerRow",
       TotalRow => "totalRow",
       FirstColumn => "firstColumn",
       LastColumn => "lastColumn",
       FirstRowStripe => "firstRowStripe",
       SecondRowStripe => "secondRowStripe",
       FirstColumnStripe => "firstColumnStripe",
       SecondColumnStripe => "secondColumnStripe",
       FirstHeaderCell => "firstHeaderCell",
       LastHeaderCell => "lastHeaderCell",
       FirstTotalCell => "firstTotalCell",
       LastTotalCell => "lastTotalCell",
       FirstSubtotalColumn => "firstSubtotalColumn",
       SecondSubtotalColumn => "secondSubtotalColumn",
       ThirdSubtotalColumn => "thirdSubtotalColumn",
       FirstSubtotalRow => "firstSubtotalRow",
       SecondSubtotalRow => "secondSubtotalRow",
       ThirdSubtotalRow => "thirdSubtotalRow",
       BlankRow => "blankRow",
       FirstColumnSubheading => "firstColumnSubheading",
       SecondColumnSubheading => "secondColumnSubheading",
       ThirdColumnSubheading => "thirdColumnSubheading",
       FirstRowSubheading => "firstRowSubheading",
       SecondRowSubheading => "secondRowSubheading",
       ThirdRowSubheading => "thirdRowSubheading",
       PageFieldLabels => "pageFieldLabels",
       PageFieldVal => "pageFieldVal",
    }
}

xml_serde_enum! {
    /// 18.18.78
    #[derive(Debug, PartialEq, Eq)]
    StTableType {
        Worksheet => "worksheet",
        Xml => "xml",
        QueryTable => "queryTable",
    }
}

xml_serde_enum! {
    /// 18.18.79
    #[derive(Debug, PartialEq, Eq)]
    StTargetScreenSize {
        FiveThree => "544x376",
        SixFour => "640x480",
        SevenFive => "720x512",
        EightSix => "800x600",
        TenSeven => "1024x768",
        ElevenEight=> "1152x882",
        ElevenNine => "1152x900",
        TwelveThen => "1280x1024",
        SixteenTwelve => "1600x1200",
        EighteenFourteen=> "1800x1440",
        NineteenTwelve=> "1920x1200",
    }
}

xml_serde_enum! {
    /// 18.18.80
    #[derive(Debug, PartialEq, Eq)]
    StTextHAlign {
        Left => "left",
        Center => "center",
        Right => "right",
        Justify => "justify",
        Distributed => "distributed",
    }
}

xml_serde_enum! {
    /// 18.18.81
    #[derive(Debug, PartialEq, Eq)]
    StTextVAlign {
        Top => "top",
        Center => "center",
        Bottom => "bottom",
        Justify => "justify",
        Distributed => "distributed",
    }
}

xml_serde_enum! {
    /// 18.18.82
    #[derive(Debug, PartialEq, Eq)]
    StTimePeriod {
       Today => "today",
       Yesterday => "yesterday",
       Tommorow => "tommorow",
       Last7Days => "last7Days",
       ThisMonth => "thisMonth",
       LastMonth => "lastMonth",
       NextMonth => "nextMonth",
       ThisWeek => "thisWeek",
       LastWeek => "lastWeek",
       NextWeek => "nextWeek",
    }
}

xml_serde_enum! {
    /// 18.18.83
    #[derive(Debug, PartialEq, Eq)]
    StTotalsRowFunction {
        None => "none",
        Sum => "sum",
        Min => "min",
        Max => "max",
        Average => "average",
        Count => "count",
        CountNums => "countNums",
        StdDev => "stdDev",
        Var => "var",
        Custom => "custom",
    }
}

xml_serde_enum! {
    /// 18.18.84
    #[derive(Debug, PartialEq, Eq)]
    StType {
        None => "none",
        All => "all",
        Row => "row",
        Column => "column",
    }
}

xml_serde_enum! {
    /// 18.18.85
    #[derive(Debug, PartialEq, Eq, Clone, Hash, serde::Serialize)]
    #[cfg_attr(feature = "gents",derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents",ts(file_name="st_underline_values.ts"))]
    StUnderlineValues {
        Single => "single",
        Double => "double",
        SingleAccounting => "singleAccounting",
        DoubleAccounting => "doubleAccounting",
        None => "none",
    }
}

xml_serde_enum! {
    /// 18.18.87
    #[derive(Debug, PartialEq, Eq)]
    StUpdateLinks {
        UserSet => "userSet",
        Never => "never",
        Always => "always",
    }
}

xml_serde_enum! {
    /// 18.18.88
    #[derive(Debug, PartialEq, Eq, Clone, Hash, serde::Serialize)]
    #[cfg_attr(feature = "gents",derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents",ts(file_name="st_vertical_alignment.ts"))]
    StVerticalAlignment {
        Top => "top",
        Center => "center",
        Bottom => "bottom",
        Justify => "justify",
        Distributed => "distributed",
    }
}

xml_serde_enum! {
    /// 18.18.89
    #[derive(Debug, PartialEq, Eq)]
    StVisibility {
        Visible => "visible",
        Hidden => "hidden",
        VeryHidden => "veryHidden",
    }
}

xml_serde_enum! {
    /// 18.18.90
    #[derive(Debug, PartialEq, Eq)]
    StVolDepType {
        RealTimeData => "realTimeData",
        OlapFunctions => "olapFunctions",
    }
}

xml_serde_enum! {
    /// 18.18.91
    #[derive(Debug, PartialEq, Eq)]
    StVolValueType {
        B => "b",
        N => "n",
        E => "e",
        S => "s",
    }
}

xml_serde_enum! {
    /// 18.18.92
    #[derive(Debug, PartialEq, Eq)]
    StWebSourceType {
        Sheet => "sheet",
        PrintArea => "printArea",
        AutoFilter => "autoFilter",
        Range => "range",
        Chart => "chart",
        PivotTable => "pivotTable",
        Query => "query",
        Label => "label",
    }
}

pub type StXmlDataType = String;

/// 18.18.94
pub type StFontFamily = u8;
pub type StUnsignedIntHex = String;

xml_serde_enum! {
    /// 18.18.92
    #[derive(Debug, PartialEq, Eq, Hash, Clone, serde::Serialize)]
    #[cfg_attr(feature = "gents",derive(gents_derives::TS))]
    #[cfg_attr(feature = "gents",ts(file_name="st_vertical_align_run.ts"))]
    StVerticalAlignRun {
        Baseline => "baseline",
        Superscript => "superscript",
        Subscript => "subscript",
    }
}

// xml_serde_enum! {
//     StFontFamily {
//         Decorative => "decorative",
//         Modern => "modern",
//         Roman => "roman",
//         Script => "script",
//         Swiss => "swiss",
//         Auto => "auto",
//     }
// }

xml_serde_enum! {
    /// 18.18.92
    #[derive(Debug, PartialEq, Eq)]
    StConformanceClass {
        Strict => "strict",
        Transitional => "transitional",
    }
}

pub type StPositiveUniversalMeasure = String;

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StCalendarType {
        Gregorian => "gregorian",
        GregorianUs => "gregorianUs",
        GregorianMeFrench => "gregorianMeFrench",
        GregorianArabic => "gregorianArabic",
        Hijri => "hijri",
        Hebrew => "hebrew",
        Taiwan => "taiwan",
        Japan => "japan",
        Thai => "thai",
        Korea => "korea",
        Saka => "saka",
        GregorianXlitEnglish => "gregorianXlitEnglish",
        GregorianXlitFrench => "gregorianXlitFrench",
        None => "none",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StTargetMode {
        External => "External",
        Internal => "Internal",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StBlackWhiteMode {
        Clr => "clr",
        Auto => "auto",
        Gray => "gray",
        LtGray => "ltGray",
        InvGray => "invGray",
        GrayWhite => "grayWhite",
        BlackGray => "blackGray",
        BlackWhite => "blackWhite",
        Black => "black",
        White => "white",
        Hidden => "hidden",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StFontCollectionIndex {
        Major => "major",
        Minor => "minor",
        None => "none",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StTextShapeType {
        TextNoShape => "textNoShape",
        TextPlain => "textPlain",
        TextStop => "textStop",
        TextTriangle => "textTriangle",
        TextTriangleInverted => "textTriangleInverted",
        TextChevron => "textChevron",
        TextChevronInverted => "textChevronInverted",
        TextRingInside => "textRingInside",
        TextRingOutside => "textRingOutside",
        TextArchUp => "textArchUp",
        TextArchDown => "textArchDown",
        TextCircle => "textCircle",
        TextButton => "textButton",
        TextArchUpPour => "textArchUpPour",
        TextArchDownPour => "textArchDownPour",
        TextCirclePour => "textCirclePour",
        TextButtonPour => "textButtonPour",
        TextCanUp => "textCanUp",
        TextCanDown => "textCanDown",
        TextWave1 => "textWave1",
        TextWave2 => "textWave2",
        TextDoubleWave1 => "textDoubleWave1",
        TextWave4 => "textWave4",
        TextInflate => "textInflate",
        TextDeflate => "textDeflate",
        TextInflateBottom => "textInflateBottom",
        TextDeflateBottom => "textDeflateBottom",
        TextInflateTop => "textInflateTop",
        TextDeflateTop => "textDeflateTop",
        TextDeflateInflate => "textDeflateInflate",
        TextDeflateInflateDeflate => "textDeflateInflateDeflate",
        TextFadeRight => "textFadeRight",
        TextFadeLeft => "textFadeLeft",
        TextFadeUp => "textFadeUp",
        TextFadeDown => "textFadeDown",
        TextSlantUp => "textSlantUp",
        TextSlantDown => "textSlantDown",
        TextCascadeUp => "textCascadeUp",
        TextCascadeDown => "textCascadeDown",
    }
}

pub type StAngle = i32;
pub type StGeomGuideFormula = String;
pub type StGeomGuideName = String;
pub type StCoordinate32 = i64;

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StTextHorzOverflowType {
        Overflow => "overflow",
        Clip => "clip",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StTextVertOverflowType {
        Overflow => "overflow",
        Ellipsis => "ellipsis",
        Clip => "clip",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StTextVerticalType {
        Horz => "horz",
        Vert => "vert",
        Vert270 => "vert270",
        WordArtVert => "wordArtVert",
        EaVert => "eavert",
        MongolianVert => "mongolianVert",
        WordArtVertRtl => "wordArtVertRtl",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StTextWrappingType {
        None => "none",
        Square => "square",
    }
}

xml_serde_enum! {
    #[derive(Debug, PartialEq, Eq)]
    StTextAnchoringType {
        T=>"t",
        Ctr => "ctr",
        B => "b",
        Just => "just",
        Dist => "dist",
    }
}

pub type StTextColumnCount = u8; // minInclusive = 1, maxInclusive = 16

pub type StPositiveCoordinate32 = u64;
