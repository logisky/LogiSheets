use chrono::{prelude::*, Duration};

#[derive(Debug, PartialEq, Clone, Copy)]
pub struct EasyDate {
    pub year: u32,
    pub month: u8,
    pub day: u8,
}

impl EasyDate {
    pub fn to_triple(&self) -> (u32, u8, u8) {
        (self.year, self.month, self.day)
    }

    pub fn last_day_of_this_month(&self) -> EasyDate {
        let month_30_days: [u8; 4] = [4, 6, 9, 11];
        if month_30_days
            .iter()
            .position(|e| e == &self.month)
            .is_some()
        {
            let mut res = self.clone();
            res.day = 30;
            res
        } else if self.month == 2 {
            let day = if self.year % 100 == 0 && self.year % 400 == 0 {
                29
            } else if self.year % 100 != 0 && self.year % 4 == 0 {
                29
            } else {
                28
            };
            let mut res = self.clone();
            res.day = day;
            res
        } else {
            let mut res = self.clone();
            res.day = 30;
            res
        }
    }

    pub fn is_last_date_of_this_month(&self) -> bool {
        &self.last_day_of_this_month() == self
    }

    // Add delta months and adjust the day
    pub fn add_delta_months(&mut self, m: i32) {
        let curr = self.month as i32;
        let months = curr + m;
        let (mut y_delta, mut month) = if months > 0 {
            (months / 12, months % 12)
        } else {
            (months / 12 - 1, months % 12 + 12)
        };
        if month == 0 {
            y_delta -= 1;
            month = 12;
        }
        let year = {
            let year = self.year as i32 + y_delta;
            if year >= 0 {
                year as u32
            } else {
                0
            }
        };
        self.year = year;
        self.month = month as u8;

        let month_30_days: [u8; 4] = [4, 6, 9, 11];
        if month_30_days
            .iter()
            .position(|e| e == &self.month)
            .is_some()
            && self.day == 31
        {
            self.day = 30
        } else if self.month == 2 && self.day > 28 {
            if self.year % 100 == 0 && self.year % 400 == 0 {
                self.day = 29
            } else if self.year % 100 != 0 && self.year % 4 == 0 {
                self.day = 29
            } else {
                self.day = 28
            }
        }
    }
}

impl PartialOrd for EasyDate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        match self.year.partial_cmp(&other.year) {
            Some(core::cmp::Ordering::Equal) | None => {}
            ord => return ord,
        }
        match self.month.partial_cmp(&other.month) {
            Some(core::cmp::Ordering::Equal) | None => {}
            ord => return ord,
        }
        self.day.partial_cmp(&other.day)
    }
}

impl From<u32> for EasyDate {
    fn from(n: u32) -> Self {
        get_date_by_serial_num_1900(n)
    }
}

#[derive(Debug)]
pub struct Time {
    pub hour: u32,
    pub minute: u32,
    pub second: u32,
}

impl Time {
    pub fn to_triple(&self) -> (u32, u32, u32) {
        (self.hour, self.minute, self.second)
    }
}

pub fn get_serial_num_by_date_1900(year: u32, month: u32, day: u32) -> Option<u32> {
    let year = if year < 1900 { year + 1900 } else { year };
    let (year, month) = {
        let (y, m) = (year + month / 12, month % 12);
        if m == 0 {
            (y - 1, 12)
        } else {
            (y, m)
        }
    };
    let init_date = NaiveDate::from_ymd(year as i32, month, 1);
    let duration = Duration::days((day - 1) as i64);
    let new_date = init_date + duration;
    let duration = new_date.signed_duration_since(NaiveDate::from_ymd(1899, 12, 31));
    let r = duration.num_days();
    if r < 1 {
        None
    } else if r <= 60 {
        // 60 represents the date 1900/2/29, though this date does not exist.
        // This was a mistake made by Microsoft Excel and we make a special
        // treament here.
        Some(r as u32)
    } else {
        Some(1 + r as u32)
    }
}

pub fn get_date_by_serial_num_1900(n: u32) -> EasyDate {
    if n == 60 {
        // This is a date which does not exist. This is why we do not use
        // NaiveDate as the return type. NaiveDate::from_ymd(1900, 2, 29) will
        // panic.
        return EasyDate {
            year: 1900,
            month: 2,
            day: 29,
        };
    }
    let n = if n <= 60 { n } else { n - 1 };
    let zero_date = NaiveDate::from_ymd(1899, 12, 31);
    let target = zero_date + Duration::days(n as i64);
    EasyDate {
        year: target.year() as u32,
        month: target.month() as u8,
        day: target.day() as u8,
    }
}

pub fn get_time_by_decimal_num(t: f64) -> Time {
    let time = t.fract();
    let seconds = (time * 86400.).round() as u32;
    let h = seconds / 3600;
    let m = (seconds / 60) % 60;
    let s = seconds % 60;
    Time {
        hour: h,
        minute: m,
        second: s,
    }
}

pub fn get_decimal_num_by_time(hour: u32, minute: u32, second: u32) -> Option<f64> {
    if hour > 32767 || minute > 32767 || second > 32767 {
        return None;
    }
    let sec = (hour * 3600 + minute * 60 + second) as f64;
    let r = (sec / 86400.).fract();
    Some(r)
}

#[cfg(test)]
mod tests {
    use super::get_date_by_serial_num_1900;
    use super::get_decimal_num_by_time;
    use super::get_serial_num_by_date_1900;
    use super::get_time_by_decimal_num;
    use super::EasyDate;

    #[test]
    fn f64_to_u32() {
        let a = 54.2;
        assert_eq!(a as u32, 54);
    }

    #[test]
    fn get_serial_num_by_date_1900_test() {
        let r = get_serial_num_by_date_1900(1900, 1, 1);
        assert_eq!(r, Some(1));
        let r = get_serial_num_by_date_1900(1900, 2, 29);
        assert_eq!(r, Some(60));
        let r = get_serial_num_by_date_1900(1900, 133, 1);
        assert_eq!(r, Some(4019));
        let r = get_serial_num_by_date_1900(2000, 133, 690);
        assert_eq!(r, Some(41233));
    }

    #[test]
    fn get_decimal_num_by_time_test() {
        let r = get_decimal_num_by_time(12, 0, 0).unwrap();
        assert!((r - 0.5).abs() < 1e-7);
        let r = get_decimal_num_by_time(32767, 32767, 32767).unwrap();
        assert!((r - 0.425775463).abs() < 1e-7);
    }

    #[test]
    fn get_date_by_serial_num_1900_test() {
        let r = get_date_by_serial_num_1900(60);
        assert_eq!(r.to_triple(), (1900, 2, 29));
        let r = get_date_by_serial_num_1900(41223);
        assert_eq!(r.to_triple(), (2012, 11, 10));
    }

    #[test]
    fn get_time_by_decimal_num_test() {
        let f = 0.14;
        let r = get_time_by_decimal_num(f);
        assert_eq!(r.to_triple(), (3, 21, 36));
        let f = 0.131;
        let r = get_time_by_decimal_num(f);
        assert_eq!(r.to_triple(), (3, 8, 38));
        let f = 0.817;
        let r = get_time_by_decimal_num(f);
        assert_eq!(r.to_triple(), (19, 36, 29));
    }

    #[test]
    fn date_add_months1() {
        let mut date = EasyDate {
            year: 2017,
            month: 6,
            day: 19,
        };
        date.add_delta_months(23);
        assert_eq!(date.year, 2019);
        assert_eq!(date.month, 5);
        assert_eq!(date.day, 19);
    }

    #[test]
    fn date_add_months2() {
        let mut date = EasyDate {
            year: 2017,
            month: 6,
            day: 19,
        };
        date.add_delta_months(6);
        assert_eq!(date.year, 2017);
        assert_eq!(date.month, 12);
        assert_eq!(date.day, 19);
    }

    #[test]
    fn date_add_months3() {
        let mut date = EasyDate {
            year: 2017,
            month: 6,
            day: 19,
        };
        date.add_delta_months(-6);
        assert_eq!(date.year, 2016);
        assert_eq!(date.month, 12);
        assert_eq!(date.day, 19);
    }
}
