pub fn multi_gcd(nums: &[u32]) -> u32 {
    if nums.len() == 0 {
        return 0;
    }
    let first = nums.get(0).unwrap().clone();
    nums.iter().fold(first, |prev, this| gcd(prev, *this))
}

pub fn gcd(n1: u32, n2: u32) -> u32 {
    let (mut a, mut b) = if n1 > n2 { (n1, n2) } else { (n2, n1) };
    while b != 0 {
        let r = a % b;
        a = b;
        b = r;
    }
    a
}

#[cfg(test)]
mod tests {
    use super::gcd;
    use super::multi_gcd;

    #[test]
    fn gcd_test() {
        assert_eq!(0, gcd(0, 0));
        assert_eq!(44, gcd(748, 2024));
        assert_eq!(10, gcd(0, 10));
        assert_eq!(2, gcd(4, 2));
        assert_eq!(12, gcd(36, 48));
    }

    #[test]
    fn multi_gcd_test() {
        let nums = vec![12, 24, 36];
        assert_eq!(12, multi_gcd(&nums));
    }
}
