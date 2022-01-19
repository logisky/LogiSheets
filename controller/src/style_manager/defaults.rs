use xlrs_workbook::complex_types::{Color, FontFamily, FontName, FontScheme};
use xlrs_workbook::simple_types::{StFontFamily, StFontScheme, StPatternType};
use xlrs_workbook::styles::Font;
use xlrs_workbook::{complex_types::FontSize, styles::*};

pub fn get_init_font() -> Font {
    Font {
        b: None,
        i: None,
        u: None,
        color: Some(Color {
            auto: None,
            indexed: None,
            rgb: None,
            theme: Some(1),
            tint: 0_f64,
        }),
        sz: Some(FontSize { val: 11. }),
        name: Some(FontName {
            val: String::from("等线"),
        }),
        charset: None,
        family: Some(FontFamily {
            val: StFontFamily::Swiss,
        }),
        strike: None,
        outline: None,
        shadow: None,
        condense: None,
        extend: None,
        vert_align: None,
        scheme: Some(FontScheme {
            val: StFontScheme::Type::Minor,
        }),
        ext_lst: None,
    }
}

pub fn get_init_fill() -> Fill {
    Fill {
        pattern_fill: Some(PatternFill {
            fg_color: None,
            bg_color: None,
            pattern_type: Some(StPatternType::Type::None),
        }),
        gradient_fill: None,
    }
}

pub fn get_init_border() -> Border {
    Border {
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
