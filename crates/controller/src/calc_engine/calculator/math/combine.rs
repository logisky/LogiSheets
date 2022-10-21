use num::ToPrimitive;

use super::fact::fact;

// Return None if the result is more than 64 bits.
pub fn calc_combine(number: u64, chosen: u64) -> Option<u64> {
    let res = fact(number) / fact(chosen) / fact(number - chosen);
    res.to_u64()
}

// Return None if the result is more than 64 bits.
pub fn calc_permut(number: u64, chosen: u64) -> Option<u64> {
    let res = fact(number) / fact(number - chosen);
    res.to_u64()
}
