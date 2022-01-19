use macros::serde_st_string_enum;
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};

pub type StXmlDataType = String;

// 18.18.1
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StAxis {
    AxisRow,
    AxisCol,
    AxisPage,
    AxisValues,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCalcMode {
    Auto,
    AutoNoTable,
    Manual,
}

pub type StBorderId = usize;

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StBorderStyle {
    DashDot,
    DashDotDot,
    Dashed,
    Dotted,
    Double,
    Hair,
    Medium,
    MediumDashDot,
    MediumDashDotDot,
    MediumDashed,
    None,
    SlantDashDot,
    Thick,
    Thin,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCellComments {
    AsDisplayed,
    AtEnd,
    None,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCellFormulaType {
    Array,
    DataTable,
    Normal,
    Shared,
}

pub type StCellRef = String;

pub type StCellSpan = String;

pub type StCellSpans = StCellSpan;

pub type StCellStyleXfId = usize;

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCellType {
    // Boolean
    B,
    // Date
    D,
    // Error
    E,
    // Inline String
    InlineStr,
    // Number
    N,
    // Cell contaning a shared string.
    S,
    // Cell containing a formula string.
    Str,
}

/// Conditional format rule type.
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCfType {
    AboveAverage,
    BeginsWith,
    CellIs,
    ColorScale,
    ContainsBlanks,
    ContainsErrors,
    ContainsText,
    DataBar,
    DuplicateValues,
    EndsWith,
    Expression,
    IconSet,
    NotContainsBlanks,
    NotContainsErrors,
    NotContainsText,
    TimePeriod,
    Top10,
    UniqueValues,
}

/// This simple type expresses the type of the conditional formatting value object.
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCfvoType {
    Formula,
    Max,
    Min,
    Num,
    Percent,
    Percentile,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StComments {
    // Show comment and indicator
    CommIndAndComment,
    CommIndicator,
    // No comments.
    CommNone,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StConditionalFormattingOperator {
    BeginsWith,
    Between,
    ContainsText,
    EndsWith,
    Equal,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    NotBetween,
    NotContains,
    NotEqual,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCredMethod {
    Integrated,
    None,
    Prompt,
    Stored,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDataConsolidateFunction {
    Average,
    Count,
    CountNums,
    Max,
    Min,
    Product,
    StdDev,
    StdDevp,
    Sum,
    Var,
    Varp,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDataValidationErrorStyle {
    Information,
    Stop,
    Warning,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDataValidationImeMode {
    Disabled,
    FullAlpha,
    FullHangul,
    FullKatakana,
    HalfAlpha,
    HalfHangul,
    HalfKatakana,
    Hiragana,
    NoControl,
    Off,
    On,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDataValidationOperator {
    Between,
    Equal,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    NotBetween,
    NotEqual,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDataValidationType {
    Custom,
    Data,
    Decimal,
    List,
    None,
    TextLength,
    Time,
    Whole,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDateTimeGrouping {
    Day,
    Hour,
    Minute,
    Month,
    Second,
    Year,
}

#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDdeValueType {
    // Bool
    B,
    // Error
    E,
    // Real Number
    N,
    // Nil
    Nil,
    // String
    Str,
}

/// 18.18.24
#[serde_st_string_enum]
pub enum StDvAspect {
    DVASPECT_CONTENT,
    DVASPECT_ICON,
}

/// 18.18.25
pub type StDxfId = u32;

/// 18.18.26
#[serde_st_string_enum]
pub enum StDynamicFilterType {
    AboveAverage,
    BelowAverage,
    LastMonth,
    LastQuater,
    LastWeek,
    LastYear,
    NextMonth,
    NextQuater,
    NextWeek,
    NextYear,
    ThisMonth,
    ThisQuater,
    ThisWeek,
    ThisYear,
    Today,
    Tommorow,
    YearToDate,
    Yesterday,
}

/// 18.18.27
#[serde_st_string_enum]
pub enum StExternalConnectionType {}

/// 18.18.28
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StFieldSortType {
    Ascending,
    Descending,
    Manual,
}

/// 18.18.29
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StFileType {
    Dos,
    Lin,
    Mac,
    Other,
    Win,
}

/// 18.18.30
pub type StFillId = usize;

/// 18.18.31
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StFilterOperator {
    Equal,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    NotEqual,
}

/// 18.18.32
pub type StFontId = usize;

/// 18.18.33
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StFontScheme {
    Major,
    Minor,
    None,
}

/// 18.18.34
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StFormatAction {
    Blank,
    Drill,
    Formatting,
    Formula,
}

/// 18.18.35
pub type StFormula = String;

/// 18.18.36
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StFormulaExpression {
    Area,
    AreaError,
    ComputedArea,
    Ref,
    RefError,
}

/// 18.18.37
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StGradientType {
    Linear,
    Path,
}

/// 18.18.38
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StGroupBy {
    Days,
    Hours,
    Minutes,
    Mounths,
    Quaters,
    Range,
    Seconds,
    Years,
}

/// 18.18.39
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StGrowShrinkType {
    InsertClear,
    InsertDelete,
    OverwriteClear,
}

/// 18.18.40
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StHorizontalAlignment {
    Center,
    CenterContinuous,
    Distributed,
    Fill,
    General,
    Justify,
    Left,
    Right,
}

/// 18.18.41
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StHtmlFmt {
    All,
    None,
    Rtf,
}

/// 18.18.42
#[serde_st_string_enum]
pub enum StIconSetType {
    #[serde(rename = "3Arrows")]
    I3Arrows,
    #[serde(rename = "3ArrowsGray")]
    I3ArrowsGray,
    #[serde(rename = "3Flags")]
    I3Flags,
    #[serde(rename = "3TrafficLights1")]
    I3TrafficLights1,
    #[serde(rename = "3TrafficLights2")]
    I3TrafficLights2,
    #[serde(rename = "3Signs")]
    I3Signs,
    #[serde(rename = "3Symbols")]
    I3Symbols,
    #[serde(rename = "3Symbols2")]
    I3Symbols2,
    #[serde(rename = "4Arrows")]
    I4Arrows,
    #[serde(rename = "4ArrowsGray")]
    I4ArrosGray,
    #[serde(rename = "RedToBlack")]
    IRedToBlack,
    #[serde(rename = "4Rating")]
    I4Rating,
    #[serde(rename = "4TrafficLights")]
    I4TrafficLights,
    #[serde(rename = "5Arrows")]
    I5Arrows,
    #[serde(rename = "5ArrowsGray")]
    I5ArrowsGray,
    #[serde(rename = "5Rating")]
    I5Rating,
    #[serde(rename = "5Quaters")]
    I5Quaters,
}

/// 18.18.43
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StItemType {
    Avg,
    Blank,
    Count,
    CountA,
    Data,
    Default,
    Grand,
    Max,
    Min,
    Product,
    StdDev,
    StdDevP,
    Sum,
    Var,
    VarP,
}

/// 18.18.44
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StDxFunctionType {
    C,
    K,
    M,
    P,
    R,
    S,
    V,
}

/// 18.18.45
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StMdxKpiProperty {
    G,
    M,
    S,
    T,
    V,
    W,
}

/// 18.18.46
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StMdxSetOrder {
    A,
    Aa,
    Ad,
    D,
    Na,
    Nd,
}

/// 18.18.47
pub type StNumFmtId = usize;

/// 18.18.48
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StObjects {
    All,
    None,
    Placeholders,
}

/// 18.18.49
#[serde_st_string_enum]
pub enum StOleUpdate {
    OLEUPDATE_ALWAYS,
    OLEUPDATE_ONCALL,
}

/// 18.18.50
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StOrientation {
    Default,
    Lancscape,
    Portrait,
}

/// 18.18.51
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPageOrder {
    DownThenOver,
    OverThenDown,
}

/// 18.18.52
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPane {
    BottomLeft,
    BottomRight,
    TopLeft,
    TopRight,
}

/// 18.18.53
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPaneState {
    Frozen,
    FrozenSplit,
    Split,
}

/// 18.18.54
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StParameterType {
    Cell,
    Prompt,
    Value,
}

/// 18.18.55
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPatternType {
    DarkDown,
    DarkGray,
    DarkGrid,
    DarkHorizontal,
    DarkTrellis,
    DarkUp,
    DarkVertical,
    Gray0625,
    Gray125,
    LightDown,
    LightGray,
    LightGrid,
    LightHorizontal,
    LightTrellis,
    LightUp,
    LightVertical,
    MediumGray,
    None,
    Solid,
}

/// 18.18.56
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPhoneticAlignment {
    Center,
    Distributed,
    Left,
    NoControl,
}

/// 18.18.57
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPhoneticType {
    FullWidthKatakana,
    HalfWidthKatakana,
    Hiragana,
    NoConversion,
}

/// 18.18.58
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPivotAreaType {
    All,
    Button,
    Data,
    None,
    Normal,
    Origin,
    TopEnd,
}

/// 18.18.59
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StPivotFilterType {}

/// 18.18.60
#[serde_st_string_enum]
pub enum StPrintError {
    blank,
    dash,
    displayed,
    NA,
}

/// 18.18.61
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StQualifier {
    DoubleQuote,
    None,
    SingleQuote,
}

/// 18.18.62
pub type StRef = String;

///18.18.63
pub type StRefA = String;

/// 18.18.64
#[serde_st_string_enum(convert_to_camel_case = false)]
pub enum StRefMode {
    A1,
    R1C1,
}

/// 18.18.65
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StRevisionAction {
    Add,
    Delete,
}

/// 18.18.66
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StRwColActionType {
    DeleteCol,
    DeleteRow,
    InsertCol,
    InsertRow,
}

/// 18.18.67
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StScope {
    Data,
    Field,
    Selection,
}

/// 18.18.68
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StSheetState {
    Hidden,
    VeryHidden,
    Visible,
}

/// 18.18.69
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StSheetViewType {
    Normal,
    PageBreakPreview,
    PageLayout,
}

/// 18.18.70
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StShowDataAs {
    Difference,
    Index,
    Normal,
    Percent,
    PercentDiff,
    PercentOfCol,
    PercentOfRow,
    PercentOfTotal,
    RunTotal,
}

/// 18.18.71
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StSmartTagShow {
    All,
    NoIndicator,
    None,
}

/// 18.18.72
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StSortBy {
    CellColor,
    FontColor,
    Icon,
    Value,
}

/// 18.18.73
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StSortMethod {
    None,
    PinYin,
    Stroke,
}

/// 18.18.74
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StSortType {
    Ascending,
    AscendingAlpha,
    AscendingNatural,
    Descending,
    DescendingAlpha,
    DescendingNatural,
    None,
}

/// 18.18.75
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StSourceType {
    Consolidation,
    External,
    Scenario,
    Worksheet,
}

/// 18.18.76
pub type StSqref = StRef;

/// 18.18.77
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StTableStyleType {
    BlankRow,
    FirstColumn,
    FirstColumnSubheading,
    FirstHeaderCell,
    FirstRowStripe,
    FirstRowSubheading,
    FirstSubtotalColumns,
    FirstSubtotalRow,
    FirstTotalCell,
    HeaderRow,
    LastColumn,
    LastHeaderCell,
    LastTotalCell,
    PageFieldLabels,
    PageFieldValues,
    SecondColumnStripe,
    SecondSColumnSubheading,
    SecondRowStripe,
    SecondRowSubheading,
    SecondSubtotalColumn,
    SecondSubtotalRow,
    ThirdColumnSubheading,
    ThirdRowSubheading,
    ThirdSubtotalColumn,
    ThirdSubtotalRow,
    TotalRow,
    WholeTable,
}

/// 18.18.78
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StTableType {
    QueryTable,
    Worksheet,
    Xml,
}

/// 18.18.79
#[serde_st_string_enum]
pub enum StTargetScreenSize {}

/// 18.18.80
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StTextHAlign {
    Center,
    Distributed,
    Justify,
    Left,
    Right,
}

/// 18.18.81
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StTextVAlign {
    Bottom,
    Center,
    Distributed,
    Justify,
    Top,
}

/// 18.18.82
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StTimePeriod {
    Last7Days,
    LastMonth,
    LastWeek,
    NextMonth,
    NextWeek,
    ThisMonth,
    ThisWeek,
    Today,
    Tomorrow,
    Yesterday,
}

/// 18.18.83
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StTotalsRowFunction {
    Average,
    Count,
    CountNums,
    Custom,
    Max,
    Min,
    None,
    StdDev,
    Sum,
    Var,
}

/// 18.18.84
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StType {
    All,
    Column,
    None,
    Row,
}

/// 18.18.85
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StUnderlineValues {
    Double,
    DoubleAccounting,
    None,
    Single,
    SingleAccounting,
}

/// 18.18.86
pub type StUnsignedIntHex = String;

/// 18.18.85
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StUpdateLinks {
    Always,
    Never,
    UserSet,
}

/// 18.18.86
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StVerticalAlignment {
    Bottom,
    Center,
    Distributed,
    Justify,
    Top,
}

/// 18.18.87
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StVisibility {
    Hidden,
    VeryHidden,
    Visible,
}

/// 18.18.87
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StVolValueType {
    B,
    E,
    N,
    SD,
}

/// 18.18.92
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StWebSourceType {
    AutoFilter,
    Chart,
    Label,
    PivotTable,
    PrintArea,
    Query,
    Range,
    Sheet,
}

pub type XtXmlDataType = String;

/// 18.18.94
#[derive(Debug, Serialize_repr, Deserialize_repr, PartialEq, Clone, Hash, Eq)]
#[serde(untagged)]
#[repr(u8)]
pub enum StFontFamily {
    NotApplicable = 0,
    Roman = 1,
    Swiss = 2,
    Modern = 3,
    Script = 4,
    Decorative = 5,
    ReservedForFutureUse1 = 6,
    ReservedForFutureUse2 = 7,
    ReservedForFutureUse3 = 8,
    ReservedForFutureUse4 = 9,
    ReservedForFutureUse5 = 10,
    ReservedForFutureUse6 = 11,
    ReservedForFutureUse7 = 12,
    ReservedForFutureUse8 = 13,
    ReservedForFutureUse9 = 14,
}

/// 22.9.2.1
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StCalendarType {
    Gregorian,
    GregorianArabic,
    GregorianMeFrench,
    GregorianUs,
    GregorianXlitEnglish,
    GregorianXlitFrench,
    Hebrew,
    Hijri,
    Japan,
    Korea,
    None,
    Saka,
    Taiwan,
    Thai,
}

/// 22.9.2.2
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StConformanceClass {
    Strict,
    Transitional,
}

/// 22.9.2.4
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename = "w:guid")]
pub struct StGuid {
    #[serde(rename = "w:val")]
    pub val: String,
}

/// 22.9.2.17
#[serde_st_string_enum(convert_to_camel_case = true)]
pub enum StVerticalAlignRun {
    Baseline,
    Subscript,
    Superscript,
}

#[cfg(test)]
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct StRefModeTest {
    pub ref_mode: StRefMode::Type,
    pub calc_mode: StCalcMode::Type,
    pub n: i32,
    pub font_family: StFontFamily,
    pub icon_set_type: StIconSetType::Type,
}

#[test]
fn st_ref_mode() {
    let input1 = StRefModeTest {
        ref_mode: StRefMode::Type::A1,
        n: 1,
        calc_mode: StCalcMode::Type::AutoNoTable,
        font_family: StFontFamily::Roman,
        icon_set_type: StIconSetType::Type::I3Arrows,
    };
    let xml_r = quick_xml::se::to_string(&input1).unwrap();
    println!("{:?}", &xml_r);
    let xml_sr: StRefModeTest = quick_xml::de::from_str(xml_r.as_str()).unwrap();
    println!("{:?}", xml_sr);
}
