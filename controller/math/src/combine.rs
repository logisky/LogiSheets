use crate::fact::fact;

pub fn calc_combine(number: u32, chosen: u32) -> u32 {
    fact(number) / fact(chosen) / fact(number - chosen)
}

pub fn calc_permut(number: u32, chosen: u32) -> u32 {
    fact(number) / fact(number - chosen)
}
