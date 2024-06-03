#[macro_use]
mod macros;
mod and;
mod asyncs;
mod average;
mod bits;
mod bonds;
mod boolean;
mod choose;
mod complex;
mod concatenate;
mod condition;
mod count;
mod countblank;
mod countif;
mod cumipmt;
mod datetime;
mod delta;
mod distribution;
mod effect;
mod exact;
mod fact;
mod fvpv;
mod gcdlcm;
mod gestep;
mod if_plugin;
mod iferror;
mod ifs;
mod im;
mod index;
mod indirect;
mod irr;
mod is;
mod iserr;
mod large;
mod leftright;
mod len;
mod lookup;
mod mode;
mod na;
mod norm_s_dist;
mod npv;
mod pduration;
mod permutation;
mod pi;
mod pmt;
mod quotient;
mod rand;
mod rank;
mod rept;
mod round;
mod row;
mod scalar_number;
mod scalar_text;
mod sln;
mod sum;
mod sumif;
mod switch;
mod tbill;
mod utils;
mod vlookup;

use logisheets_parser::ast;

use super::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;

pub fn function_calculate<C>(name: &str, args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if fetcher.is_async_func(name) {
        return asyncs::calc(name, args, fetcher);
    }
    match name.to_uppercase().as_str() {
        "ABS" => scalar_number::calc_abs(args, fetcher),
        "ACCRINT" => bonds::accrint::calc_accrint(args, fetcher),
        "ACCRINTM" => bonds::accrint::calc_accrintm(args, fetcher),
        "ACOS" => scalar_number::calc_acos(args, fetcher),
        "ACOSH" => scalar_number::calc_acosh(args, fetcher),
        "AND" => and::calc(args, fetcher),
        "ASIN" => scalar_number::calc_asin(args, fetcher),
        "ASINH" => scalar_number::calc_asinh(args, fetcher),
        "ATAN" => scalar_number::calc_atan(args, fetcher),
        "ATANH" => scalar_number::calc_atanh(args, fetcher),
        "AVERAGE" => average::calc_average(args, fetcher),
        "AVERAGEIF" => sumif::calc_averageif(args, fetcher),
        "AVERAGEIFS" => sumif::calc_averageifs(args, fetcher),
        "BIN2DEC" => bits::hob2dec::calc_bin2dec(args, fetcher),
        "BIN2HEX" => bits::hob2hob::calc_bin2hex(args, fetcher),
        "BIN2OCT" => bits::hob2hob::calc_bin2oct(args, fetcher),
        "BINOM.DIST" => distribution::binom::calc(args, fetcher),
        "BINOMDIST" => distribution::binom::calc(args, fetcher),
        "BINOM.INV" => distribution::binom::calc_inv(args, fetcher),
        "BITAND" => bits::bit::calc_bitand(args, fetcher),
        "BITLSHIFT" => bits::bit::calc_bitlshift(args, fetcher),
        "BITOR" => bits::bit::calc_bitor(args, fetcher),
        "BITRSHIFT" => bits::bit::calc_bitrshift(args, fetcher),
        "BITXOR" => bits::bit::calc_bitxor(args, fetcher),
        "CHISQ.DIST" => distribution::chisqdist::calc_chisqdist(args, fetcher),
        "CHISQ.DIST.RT" => distribution::chisqdist::calc_chisqdist_rt(args, fetcher),
        "CHOOSE" => choose::calc(args, fetcher),
        "COLUMN" => row::calc_column(args, fetcher),
        "COLUMNS" => row::calc_columns(args, fetcher),
        "COMBIN" => permutation::calc_combine(args, fetcher),
        "COMPLEX" => complex::calc(args, fetcher),
        "CONCATENATE" => concatenate::calc(args, fetcher),
        "COS" => scalar_number::calc_cos(args, fetcher),
        "COT" => scalar_number::calc_cot(args, fetcher),
        "COTH" => scalar_number::calc_coth(args, fetcher),
        "COUNT" => count::calc(args, fetcher),
        "COUNTBLANK" => countblank::calc(args, fetcher),
        "COUNTIF" => countif::calc(args, fetcher),
        "COUNTIFS" => sumif::calc_countifs(args, fetcher),
        "COUPNCD" => bonds::coupncd::calc(args, fetcher),
        "COUPNUM" => bonds::coupnum::calc(args, fetcher),
        "COUPPCD" => bonds::couppcd::calc(args, fetcher),
        "#CRITBINOM" => distribution::binom::calc_inv(args, fetcher),
        "CSC" => scalar_number::calc_csc(args, fetcher),
        "CUMIPMT" => cumipmt::cumipmt(args, fetcher),
        "DATE" => datetime::date::calc(args, fetcher),
        "DAY" => datetime::ymd::calc_day(args, fetcher),
        "DAYS" => datetime::days::calc(args, fetcher),
        "DEC2BIN" => bits::dec2hob::calc_dec2bin(args, fetcher),
        "DEC2HEX" => bits::dec2hob::calc_dec2hex(args, fetcher),
        "DEC2OCT" => bits::dec2hob::calc_dec2oct(args, fetcher),
        "DEGREES" => scalar_number::calc_degrees(args, fetcher),
        "DELTA" => delta::calc(args, fetcher),
        "DISC" => bonds::disc::calc(args, fetcher),
        "EDATE" => datetime::edate::calc(args, fetcher),
        "EFFECT" => effect::effect(args, fetcher),
        "EOMONTH" => datetime::eomonth::calc(args, fetcher),
        "EVEN" => scalar_number::calc_even(args, fetcher),
        "EXACT" => exact::calc(args, fetcher),
        "EXP" => scalar_number::calc_exp(args, fetcher),
        "EXPON.DIST" => distribution::exp::calc(args, fetcher),
        "EXPONDIST" => distribution::exp::calc(args, fetcher),
        "F.DIST" => distribution::fisher::calc(args, fetcher),
        "FDIST" => distribution::fisher::calc(args, fetcher),
        "FACT" => fact::calc(args, fetcher),
        "FACTDOUBLE" => scalar_number::calc_factdouble(args, fetcher),
        "FALSE" => boolean::calc_false(args),
        "FV" => fvpv::fv(args, fetcher),
        "GAMMA" => scalar_number::calc_gamma(args, fetcher),
        "GAMMA.DIST" => distribution::gammadist::calc_gammadist(args, fetcher),
        "GAMMADIST" => distribution::gammadist::calc_gammadist(args, fetcher),
        "GAMMALN" => scalar_number::calc_gammaln(args, fetcher),
        "GAMMALN.PRECISE" => scalar_number::calc_gammaln(args, fetcher),
        "GCD" => gcdlcm::calc_gcd(args, fetcher),
        "GEOMEAN" => average::calc_geomean(args, fetcher),
        "GESTEP" => gestep::calc(args, fetcher),
        "HARMEAN" => average::calc_harmean(args, fetcher),
        "HEX2BIN" => bits::hob2hob::calc_hex2bin(args, fetcher),
        "HEX2DEC" => bits::hob2dec::calc_hex2dec(args, fetcher),
        "HEX2OCT" => bits::hob2hob::calc_hex2oct(args, fetcher),
        "HLOOKUP" => lookup::calc_hlookup(args, fetcher),
        "HOUR" => datetime::hms::calc_hour(args, fetcher),
        "IF" => if_plugin::calc(args, fetcher),
        "IFERROR" => iferror::calc_iferror(args, fetcher),
        "IFNA" => iferror::calc_ifna(args, fetcher),
        "IFS" => ifs::calc(args, fetcher),
        "IMABS" => im::calc_imabs(args, fetcher),
        "IMAGINARY" => im::calc_imaginary(args, fetcher),
        "IMCONJUGATE" => im::calc_imconjugate(args, fetcher),
        "IMCOS" => im::calc_imcos(args, fetcher),
        "IMCOSH" => im::calc_imcosh(args, fetcher),
        "IMCOT" => im::calc_imcot(args, fetcher),
        "IMCSC" => im::calc_imcsc(args, fetcher),
        "IMEXP" => im::calc_imexp(args, fetcher),
        "IMLN" => im::calc_imln(args, fetcher),
        "IMLOG10" => im::calc_imlog10(args, fetcher),
        "IMLOG2" => im::calc_imlog2(args, fetcher),
        "IMREAL" => im::calc_imreal(args, fetcher),
        "IMSEC" => im::calc_imsec(args, fetcher),
        "IMSIN" => im::calc_imsin(args, fetcher),
        "IMSINH" => im::calc_imsinh(args, fetcher),
        "IMTAN" => im::calc_imtan(args, fetcher),
        "IMTANH" => im::calc_imtanh(args, fetcher),
        "INDEX" => index::calc(args, fetcher),
        "INDIRECT" => indirect::calc(args, fetcher),
        "INTRATE" => bonds::intrate::calc(args, fetcher),
        "IPMT" => pmt::ipmt(args, fetcher),
        "IRR" => irr::calc(args, fetcher),
        "ISBLANK" => is::calc_isblank(args, fetcher),
        "ISERR" => iserr::calc(args, fetcher, iserr::IsErrType::ExceptNa),
        "ISERROR" => iserr::calc(args, fetcher, iserr::IsErrType::All),
        "ISLOGICAL" => is::calc_islogical(args, fetcher),
        "ISNA" => iserr::calc(args, fetcher, iserr::IsErrType::Na),
        "ISNONTEXT" => is::calc_isnontext(args, fetcher),
        "ISNUMBER" => is::calc_isnumber(args, fetcher),
        "ISTEXT" => is::calc_istext(args, fetcher),
        "LARGE" => large::calc_large(args, fetcher),
        "LCM" => gcdlcm::calc_lcm(args, fetcher),
        "LEFT" => leftright::calc_left(args, fetcher),
        "LEN" => len::calc_len(args, fetcher),
        "LENB" => len::calc_lenb(args, fetcher),
        "LN" => scalar_number::calc_ln(args, fetcher),
        "LOG10" => scalar_number::calc_log10(args, fetcher),
        "LOWER" => scalar_text::calc_lower(args, fetcher),
        "MAXIFS" => sumif::calc_maxifs(args, fetcher),
        "MINIFS" => sumif::calc_minifs(args, fetcher),
        "MINUTE" => datetime::hms::calc_minute(args, fetcher),
        "MODE" => mode::calc(args, fetcher),
        "MODE.SNGL" => mode::calc(args, fetcher),
        "MONTH" => datetime::ymd::calc_month(args, fetcher),
        "MROUND" => round::calc_mround(args, fetcher),
        "NA" => na::calc(args),
        "NEGBINOM.DIST" => distribution::negative_binomial::calc(args, fetcher),
        "NEGBINOMDIST" => distribution::negative_binomial::calc(args, fetcher),
        "NOMINAL" => effect::nominal(args, fetcher),
        "NORM.DIST" => distribution::normdist::calc_normdist(args, fetcher),
        "NORM.S.DIST" => norm_s_dist::calc(args, fetcher),
        "NORM.S.INV" => distribution::norminv::calc_normsinv(args, fetcher),
        "NORMDIST" => distribution::normdist::calc_normdist(args, fetcher),
        "NORMINV" => distribution::norminv::calc_norminv(args, fetcher),
        "NORMSDIST" => scalar_number::calc_normsdist(args, fetcher),
        "NORMSINV" => distribution::norminv::calc_normsinv(args, fetcher),
        "NOW" => datetime::now::calc(args, fetcher),
        "NPV" => npv::calc(args, fetcher),
        "OCT2BIN" => bits::hob2hob::calc_oct2bin(args, fetcher),
        "OCT2DEC" => bits::hob2dec::calc_oct2dec(args, fetcher),
        "OCT2HEX" => bits::hob2hob::calc_oct2hex(args, fetcher),
        "ODD" => scalar_number::calc_odd(args, fetcher),
        "PDURATION" => pduration::pduration(args, fetcher),
        "PERMUT" => permutation::calc_permut(args, fetcher),
        "PI" => pi::calc(args),
        "PMT" => pmt::pmt(args, fetcher),
        "POISSON" => distribution::poisson::calc(args, fetcher),
        "POISSON.DIST" => distribution::poisson::calc(args, fetcher),
        "PPMT" => pmt::ppmt(args, fetcher),
        "PRICE" => bonds::price::calc(args, fetcher),
        "PRICEDISC" => bonds::pricedisc::calc(args, fetcher),
        "PRICEMAT" => bonds::pricemat::calc(args, fetcher),
        "PV" => fvpv::pv(args, fetcher),
        "QUOTIENT" => quotient::calc(args, fetcher),
        "RADIANS" => scalar_number::calc_radians(args, fetcher),
        "RAND" => rand::calc(args, fetcher),
        "RANDBETWEEN" => rand::calc_randbetween(args, fetcher),
        "RANK" => rank::calc_rank(args, fetcher),
        "RANK.AVG" => rank::calc_rank_avg(args, fetcher),
        "RANK.EQ" => rank::calc_rank(args, fetcher),
        "RECEIVED" => bonds::received::calc(args, fetcher),
        "REPT" => rept::calc(args, fetcher),
        "RIGHT" => leftright::calc_right(args, fetcher),
        "ROUND" => round::calc_round(args, fetcher),
        "ROUNDUP" => round::calc_roundup(args, fetcher),
        "ROUNDDOWN" => round::calc_rounddown(args, fetcher),
        "ROW" => row::calc_row(args, fetcher),
        "ROWS" => row::calc_rows(args, fetcher),
        "RRI" => pduration::rri(args, fetcher),
        "SECOND" => datetime::hms::calc_second(args, fetcher),
        "SIGN" => scalar_number::calc_sign(args, fetcher),
        "SIN" => scalar_number::calc_sin(args, fetcher),
        "SLN" => sln::sln(args, fetcher),
        "SMALL" => large::calc_small(args, fetcher),
        "SQRT" => scalar_number::calc_sqrt(args, fetcher),
        "SQRTPI" => scalar_number::calc_sqrtpi(args, fetcher),
        "STDEV" => distribution::statistics::calc_stdev(args, fetcher),
        "SUM" => sum::calc(args, fetcher),
        "SUMIF" => sumif::calc_sumif(args, fetcher),
        "SUMIFS" => sumif::calc_sumifs(args, fetcher),
        "SUMSQ" => sum::calc_sumsq(args, fetcher),
        "SWITCH" => switch::calc(args, fetcher),
        "SYD" => sln::syd(args, fetcher),
        "TAN" => scalar_number::calc_tan(args, fetcher),
        "TANH" => scalar_number::calc_tanh(args, fetcher),
        "TBILLEQ" => tbill::calc_tbilleq(args, fetcher),
        "TBILLPRICE" => tbill::calc_tbillprice(args, fetcher),
        "TBILLYIELD" => tbill::calc_tbillyield(args, fetcher),
        "TIME" => datetime::time::calc(args, fetcher),
        "TODAY" => datetime::today::calc(args),
        "TRIM" => scalar_text::calc_trim(args, fetcher),
        "TRUE" => boolean::calc_true(args),
        "UPPER" => scalar_text::calc_upper(args, fetcher),
        "VAR" => distribution::statistics::calc_var(args, fetcher),
        "VAR.S" => distribution::statistics::calc_var(args, fetcher),
        "VLOOKUP" => lookup::calc_vlookup(args, fetcher),
        "WEEKDAY" => datetime::weekday::calc(args, fetcher),
        "WEIBULL" => distribution::weibull::calc(args, fetcher),
        "WEIBULL.DIST" => distribution::weibull::calc(args, fetcher),
        "YEAR" => datetime::ymd::calc_year(args, fetcher),
        "YIELDDISC" => bonds::yielddisc::calc(args, fetcher),
        "YIELDMAT" => bonds::yieldmat::calc(args, fetcher),
        _ => CalcVertex::from_error(ast::Error::Name),
    }
}
