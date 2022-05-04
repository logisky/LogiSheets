use logisheets_workbook::prelude::*;

pub fn get_init_font() -> CtFont {
    CtFont {
        bold: false,
        italic: false,
        underline: None,
        color: Some(CtColor {
            auto: None,
            indexed: None,
            rgb: None,
            theme: None,
            tint: 0_f64,
        }),
        sz: Some(CtFontSize { val: 11. }),
        name: Some(CtFontName {
            val: String::from("等线"),
        }),
        charset: None,
        family: Some(CtFontFamily {
            val: 2, // Swiss
        }),
        strike: false,
        outline: false,
        shadow: false,
        condense: false,
        extend: false,
        vert_align: None,
        scheme: Some(CtFontScheme {
            val: StFontScheme::Minor,
        }),
    }
}

pub fn get_init_fill() -> CtFill {
    CtFill::PatternFill(CtPatternFill {
        fg_color: None,
        bg_color: None,
        pattern_type: Some(StPatternType::None),
    })
}

pub fn get_init_border() -> CtBorder {
    CtBorder {
        left: None,
        right: None,
        top: None,
        bottom: None,
        diagonal: None,
        vertical: None,
        horizontal: None,
        diagonal_up: None,
        diagonal_down: None,
        outline: true,
    }
}
