#[macro_use]
extern crate logiutils;
extern crate pest;
#[macro_use]
extern crate pest_derive;

use parser::ast;
use pest::iterators::Pair;
use pest::Parser;

#[derive(Parser)]
#[grammar = "grammar.pest"]
pub struct FormatterParser;

pub fn lex(s: &str) -> Option<Pair<Rule>> {
    let result = FormatterParser::parse(Rule::start, s);
    match result {
        Ok(mut r) => {
            let tokens = r.next().unwrap();
            Some(tokens)
        }
        Err(e) => {
            log!("{:?}", e);
            None
        }
    }
}

pub struct Formatter {}

impl Formatter {
    pub fn format(value: ast::Value, formatter: String) -> FormatResult {
        // TODO 缓存formatter生成出来的calculator
        let res = lex(&formatter);
        match res {
            Some(lexed) => Calculator::new(lexed).run(value),
            None => todo!(),
        }
    }
}

struct Calculator {
    pub positive_part: Part,
    pub negative_part: Part,
    pub zero_part: Part,
    pub text_part: Part,
}

impl Calculator {
    pub fn new(root: Pair<Rule>) -> Self {
        // TODO 在根节点分出part
        for pair in root.into_inner() {
            let curr_part = Part::new(pair);
        }
        Calculator {
            negative_part: Part::empty(),
            positive_part: Part::empty(),
            text_part: Part::empty(),
            zero_part: Part::empty(),
        }
    }
    pub fn run(self, value: ast::Value) -> FormatResult {
        todo!()
    }
}
// TIPS
// 先试试看单纯数字类型的part
// 考虑如何遍历lexer出来的语法树
pub struct Part {
    pub scalar: u32,
    pub interger_bits: u32,
    pub decimal_bits: u32,
    // TODO 分数
    // TODO 科学计数
    // TODO 时间
    // pub part: Vec<Token>,
}

impl Part {
    pub fn empty() -> Self {
        Part {
            decimal_bits: 0,
            interger_bits: 0,
            scalar: 0,
        }
    }
    pub fn new(root: Pair<Rule>) -> Self {
        visit_pair(root);
        // 基本思路，用全局的域记录状态，即Rule之间上下文
        // 前序遍历
        fn visit_pair(pair: Pair<Rule>) {
            match pair.as_rule() {
                Rule::any => visit_children(pair),
                Rule::any_no_text => visit_children(pair),
                Rule::any_no_cond => visit_children(pair),
                Rule::any_no_text_no_cond => visit_children(pair),
                Rule::general => todo!(),
                Rule::number => {
                    // 只有在这个模式下的part_num 需要记录%,和.
                    let mut inner_rules = pair.into_inner();
                    let part_num = inner_rules.next().unwrap();
                    build_number(part_num)
                    // TODO
                }
                Rule::date_time_token => todo!(),
                Rule::abs_time_token => todo!(),
                Rule::date_time => todo!(),
                Rule::text => todo!(),
                Rule::fraction => todo!(),
                Rule::part_num => {
                    //
                }
                Rule::part_exponential => todo!(),
                Rule::part_year => todo!(),
                Rule::part_month => todo!(),
                Rule::part_day => todo!(),
                Rule::part_hour => todo!(),
                Rule::part_abs_hour => todo!(),
                Rule::part_minute => todo!(),
                Rule::part_abs_minute => todo!(),
                Rule::part_second => todo!(),
                Rule::part_abs_second => todo!(),
                Rule::part_sub_second => todo!(),
                Rule::part_cond => todo!(),
                Rule::part_comp_oper => todo!(),
                Rule::part_locale_id => todo!(),
                Rule::part_cond_num => todo!(),
                Rule::part_sign => todo!(),
                Rule::part_color => todo!(),
                Rule::part_1_to_56 => todo!(),
                Rule::part_int_num => todo!(),
                Rule::part_num_token1 => todo!(),
                Rule::part_num_token2 => todo!(),
                Rule::part_fraction => todo!(),
                Rule::part_number_1_to_4 => todo!(),
                Rule::part_number_1_to_6 => todo!(),
                Rule::part_number_1_to_9 => todo!(),
                Rule::part_str_color => todo!(),
                Rule::literal_char => todo!(),
                Rule::literal_char_special => todo!(),
                Rule::literal_char_repeat => todo!(),
                Rule::literal_string => todo!(),
                Rule::utf16_any_without_quote => todo!(),
                Rule::literal_char_space => todo!(),
                Rule::intl_char_decimal_sep => todo!(),
                Rule::intl_char_numgrp_sep => todo!(),
                Rule::intl_char_date_sep => todo!(),
                Rule::intl_char_time_sep => todo!(),
                Rule::intl_color => todo!(),
                Rule::intl_numfmt_general => todo!(),
                Rule::intl_ampm => todo!(),
                Rule::utf16_any => todo!(),
                Rule::digit_zero => todo!(),
                Rule::quotation_mark => todo!(),
                Rule::number_sign => todo!(),
                Rule::dollar_sign => todo!(),
                Rule::percent_sign => todo!(),
                Rule::asterisk => todo!(),
                Rule::plus_sign => todo!(),
                Rule::comma => todo!(),
                Rule::hyphen_minus => todo!(),
                Rule::full_stop => todo!(),
                Rule::solidus => todo!(),
                Rule::colon => todo!(),
                Rule::less_than_sign => todo!(),
                Rule::equals_sign => todo!(),
                Rule::greater_than_sign => todo!(),
                Rule::question_mark => todo!(),
                Rule::commercial_at => todo!(),
                Rule::capital_letter_e => todo!(),
                Rule::small_letter_y => todo!(),
                Rule::small_letter_m => todo!(),
                Rule::small_letter_d => todo!(),
                Rule::small_letter_h => todo!(),
                Rule::small_letter_s => todo!(),
                Rule::left_square_bracket => todo!(),
                Rule::reverser_solidus => todo!(),
                Rule::right_square_bracket => todo!(),
                Rule::low_line => todo!(),
                Rule::digit_hexadecimal => todo!(),
                // TODO 处理子节点
                Rule::literal => visit_children(pair),
                _ => todo!(),
            }
        }
        fn visit_children(pair: Pair<Rule>) {
            for pair in pair.into_inner() {
                visit_pair(pair)
            }
        }
        fn build_number(part_num: Pair<Rule>) {}
        Part {
            decimal_bits: 0,
            interger_bits: 0,
            scalar: 0,
        }
    }
}

pub enum Token {
    String(String),
}

pub struct FormatResult {
    pub text: String,
}

#[test]
fn general() {
    lex("General").unwrap();
    lex("G/通用格式").unwrap();
}

#[test]
fn number() {
    lex("0").unwrap();
    lex("0.00").unwrap();
    lex("#,##0").unwrap();
    lex("#,##0.00").unwrap();
    lex("#,###.00").unwrap();
    lex("0.00_);[红色](0.00)").unwrap();
    lex("0.00_);(0.00)").unwrap();
    lex("0.00;[红色]0.00").unwrap();
    lex("0.00_ ").unwrap();
    lex("0.00_ ;[红色]-0.00 ").unwrap();
    lex("#,##0 ;(#,##0)").unwrap();
    lex("#,##0 ;[Red](#,##0)").unwrap();
    lex("#,##0.00;(#,##0.00)").unwrap();
    lex("#,##0.00;[Red](#,##0.00)").unwrap();
    lex("_ * #,##0_ ;_ * -#,##0_ ;_ * \"-\"_ ;_ @_ ").unwrap();
    lex("_ * #,##0.00_ ;_ * -#,##0.00_ ;_ * \"-\"??_ ;_ @_ ").unwrap();
    lex("_ ¥* #,##0_ ;_ ¥* -#,##0_ ;_ ¥* \"-\"_ ;_ @_ ").unwrap();
    lex("_ ¥* #,##0.00_ ;_ ¥* -#,##0.00_ ;_ ¥* \"-\"??_ ;_ @_ ").unwrap();
    lex("#,##0;-#,##0").unwrap();
    lex("#,##0;[红色]-#,##0").unwrap();
    lex("#,##0.00;-#,##0.00").unwrap();
    lex("#,##0.00;[红色]-#,##0.00").unwrap();
    lex("¥#,##0;¥-#,##0").unwrap();
    lex("¥#,##0;[红色]¥-#,##0").unwrap();
    lex("¥#,##0.00;¥-#,##0.00").unwrap();
    lex("¥#,##0.00;[红色]¥-#,##0.00").unwrap();
    lex("$#,##0_);($#,##0)").unwrap();
    lex("$#,##0_);[红色]($#,##0)").unwrap();
    lex("$#,##0.00_);($#,##0.00)").unwrap();
    lex("$#,##0.00_);[红色]($#,##0.00)").unwrap();
}

#[test]
fn percent() {
    lex("0%").unwrap();
    lex("0.00%").unwrap();
    lex("0.000000%").unwrap();
}

#[test]
fn scientific() {
    lex("0.00E+00").unwrap();
    lex("##0.0E+0").unwrap();
    lex("##0.00E+00").unwrap();
}

#[test]
fn fraction() {
    lex("# ?/?").unwrap();
    lex("# ??/??").unwrap();
    lex("# ???/???").unwrap();
    lex("# ?/2").unwrap();
    lex("# ?/4").unwrap();
    lex("# ?/8").unwrap();
    lex("# ??/16").unwrap();
    lex("# ??/10").unwrap();
    lex("# ??/100").unwrap();
}

#[test]
fn datetime() {
    lex("mm-dd-yy").unwrap();
    lex("d-mmm-yy").unwrap();
    lex("d-mmm").unwrap();
    lex("mmm-yy").unwrap();
    lex("h:mm AM/PM").unwrap();
    lex("h:mm:ss AM/PM").unwrap();
    lex("h:mm").unwrap();
    lex("h:mm:ss").unwrap();
    lex("m/d/yy h:mm").unwrap();
    lex("mm:ss").unwrap();
    lex("[h]:mm:ss").unwrap();
    lex("mmss.0").unwrap();
    lex("yyyy/m/d").unwrap();
    // lex("[$-x-sysdate]dddd, mmmm dd, yyyy").unwrap();
    lex("yyyy-mm-dd;@").unwrap();
    // lex("[DBNum1][$-zh-CN]yyyy\"年\"m\"月\"d\"日\";@").unwrap();
    // lex("[DBNum1][$-zh-CN]yyyy\"年\"m\"月\";@").unwrap();
    // lex("[DBNum1][$-zh-CN]m\"月\"d\"日\";@").unwrap();
    lex("yyyy\"年\"m\"月\"d\"日\";@").unwrap();
    lex("yyyy\"年\"m\"月\";@").unwrap();
    lex("m\"月\"d\"日\";@").unwrap();
    // lex("[$-zh-CN]aaaa;@").unwrap();
    // lex("[$-zh-CN]aaa;@").unwrap();
    lex("yyyy/m/d;@").unwrap();
    lex("[$-en-US]yyyy/m/d h:mm AM/PM;@").unwrap();
    lex("yyyy/m/d h:mm;@").unwrap();
    lex("yy/m/d;@").unwrap();
    lex("m/d;@").unwrap();
    lex("m/d/yy;@").unwrap();
    lex("mm/dd/yy;@").unwrap();
    lex("[$-en-US]d-mmm;@").unwrap();
    lex("[$-en-US]d-mmm-yy;@").unwrap();
    lex("[$-en-US]dd-mmm-yy;@").unwrap();
    lex("[$-en-US]mmm-yy;@").unwrap();
    lex("[$-en-US]mmmm-yy;@").unwrap();
    lex("[$-en-US]mmmmm;@").unwrap();
    lex("[$-en-US]mmmmm-yy;@").unwrap();
    lex("[$-x-systime]h:mm:ss AM/PM").unwrap();
    lex("h:mm;@").unwrap();
    lex("[$-en-US]h:mm AM/PM;@").unwrap();
    lex("h:mm:ss;@").unwrap();
    lex("[$-en-US]h:mm:ss AM/PM;@").unwrap();
    lex("h\"时\"mm\"分\";@").unwrap();
    lex("h\"时\"mm\"分\"ss\"秒\";@").unwrap();
    lex("上午/下午h\"时\"mm\"分\";@").unwrap();
    lex("上午/下午h\"时\"mm\"分\"ss\"秒\";@").unwrap();
    // lex("[DBNum1][$-zh-CN]h\"时\"mm\"分\";@").unwrap();
    // lex("[DBNum1][$-zh-CN]上午/下午h\"时\"mm\"分\";@").unwrap();
}

#[test]
fn text() {
    lex("@").unwrap();
}

#[test]
fn cond() {
    lex("[Red][<>1]General").unwrap();
}

#[test]
fn run() {
    let root = lex("0.00").unwrap();
    let cal = Calculator::new(root);
    cal;
}
