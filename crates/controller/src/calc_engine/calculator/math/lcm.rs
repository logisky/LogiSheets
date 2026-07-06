use super::gcd::gcd;

/// Least common multiple of `nums`. Returns `None` if the result overflows
/// `u64` (the caller maps that to `#NUM!`). LCM with any zero operand is 0.
pub fn multi_lcm(nums: &[u64]) -> Option<u64> {
    let mut acc: u64 = 1;
    for &t in nums {
        if t == 0 {
            return Some(0);
        }
        let d = gcd(acc, t);
        // Divide before multiplying to keep the intermediate value small,
        // then guard the remaining multiplication against overflow.
        acc = (acc / d).checked_mul(t)?;
    }
    Some(acc)
}

#[cfg(test)]
mod tests {
    use super::multi_lcm;
    #[test]
    fn lcm_test() {
        let input = [2_u64, 4_u64, 6_u64, 8_u64];
        let result = multi_lcm(&input);
        assert_eq!(result, Some(24));
        let input = [32_u64, 4_u64, 6_u64, 8_u64];
        let result = multi_lcm(&input);
        assert_eq!(result, Some(96));
    }

    #[test]
    fn lcm_zero_and_overflow_test() {
        assert_eq!(multi_lcm(&[0, 0]), Some(0));
        assert_eq!(multi_lcm(&[0, 5]), Some(0));
        // Two large coprime values whose product exceeds u64::MAX.
        assert_eq!(multi_lcm(&[(1u64 << 62) + 1, (1u64 << 62) + 3]), None);
    }
}
