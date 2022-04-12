use crate::gcd::gcd;

pub fn multi_lcm(nums: &[u32]) -> u32 {
    let multi = nums.iter().fold(1_u32, |prev, t| {
        let d = gcd(prev, *t);
        prev * *t / d
    });
    multi
}

#[cfg(test)]
mod tests {
    use super::multi_lcm;
    #[test]
    fn lcm_test() {
        let input = [2_u32, 4_u32, 6_u32, 8_u32];
        let result = multi_lcm(&input);
        assert_eq!(result, 24);
        let input = [32_u32, 4_u32, 6_u32, 8_u32];
        let result = multi_lcm(&input);
        assert_eq!(result, 96);
    }
}
