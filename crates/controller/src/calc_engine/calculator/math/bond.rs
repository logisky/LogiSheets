use logisheets_base::datetime::{get_serial_num_by_date_1900, EasyDate};

pub fn couppcd(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settle_date = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let delta_month = -12 / freq as i32;

    let mut idx = 1;

    loop {
        let mut curr = maturity_date.clone();
        curr.add_delta_months(idx * delta_month);
        if curr < settle_date {
            if maturity_date.is_last_date_of_this_month() {
                curr = curr.last_day_of_this_month();
            }
            return get_serial_num_by_date_1900(curr.year, curr.month as u32, curr.day as u32)
                .unwrap();
        } else {
            idx += 1;
        }
    }
}

pub fn coupncd(settle: u32, maturity: u32, freq: u8) -> u32 {
    assert!(freq == 1 || freq == 2 || freq == 4);
    let settle_date = EasyDate::from(settle);
    let maturity_date = EasyDate::from(maturity);

    let delta_month = -12 / freq as i32;

    let mut idx = 1;

    loop {
        let mut curr = maturity_date.clone();
        curr.add_delta_months(idx * delta_month);
        if curr < settle_date {
            if maturity_date.is_last_date_of_this_month() {
                curr = curr.last_day_of_this_month();
            }

            curr.add_delta_months(-delta_month);

            if curr > maturity_date {
                curr = maturity_date
            }
            return get_serial_num_by_date_1900(curr.year, curr.month as u32, curr.day as u32)
                .unwrap();
        } else {
            idx += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{coupncd, couppcd};
    use logisheets_base::datetime::get_serial_num_by_date_1900;

    #[test]
    fn test_couppcd() {
        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 4;
        let res = couppcd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2018, 11, 30).unwrap());

        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 1;
        let res = couppcd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2018, 2, 28).unwrap());
    }

    #[test]
    fn test_coupncd() {
        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 4;
        let res = coupncd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2019, 2, 28).unwrap());

        let settle = get_serial_num_by_date_1900(2018, 12, 31).unwrap();
        let maturity = get_serial_num_by_date_1900(2021, 2, 28).unwrap();
        let freq = 1;
        let res = coupncd(settle, maturity, freq);
        assert_eq!(res, get_serial_num_by_date_1900(2019, 2, 28).unwrap());
    }
}
