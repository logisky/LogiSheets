use gents::*;
use gents_derives::TS;

#[derive(TS)]
#[ts(file_name = "person.ts", rename_all = "camelCase")]
pub struct Person {
    pub age: u16,
    pub en_name: String,
}

#[derive(TS)]
#[ts(file_name = "group.ts", rename_all = "camelCase")]
pub struct Group {
    pub name: String,
    pub capacity: u16,
    pub members: Vec<Person>,
    pub leader: Option<Person>,
}

#[derive(TS)]
#[ts(file_name = "gender.ts")]
pub enum Gender {
    Male,
    Female,
    #[ts(rename = "null")]
    Unknown,
}

#[derive(TS)]
#[ts(file_name = "pet.ts", rename_all = "camelCase")]
pub enum Pet {
    Cat(String),
    Dog(String),
    #[ts(rename = "None")]
    None,
}

#[cfg(test)]
mod tests {

    use super::*;

    #[test]
    fn gen_data_person_test() {
        let mut manager = DescriptorManager::default();
        Person::_register(&mut manager);
        let (file_name, content) = manager.gen_data().into_iter().next().unwrap();
        assert_eq!(file_name, "person.ts");
        assert_eq!(
            content.trim(),
            r#"export interface Person {
    age: number,
    enName: string,
}"#
        )
    }

    #[test]
    fn gen_data_group_test() {
        let mut manager = DescriptorManager::default();
        Group::_register(&mut manager);
        let (file_name, content) = manager.gen_data().into_iter().last().unwrap();
        assert_eq!(file_name, "group.ts");
        assert_eq!(
            content,
            r#"import Person from './person.ts'

export interface Group {
    name: string,
    capacity: number,
    members: readonly Person[],
    leader?: Person,
}
"#
        );
    }

    #[test]
    fn gen_data_gender_test() {
        let mut manager = DescriptorManager::default();
        Gender::_register(&mut manager);
        let (file_name, content) = manager.gen_data().into_iter().next().unwrap();
        assert_eq!(file_name, "gender.ts");
        assert_eq!(
            content.trim(),
            r#"export type = "Male"
    | "Female"
    | "null""#
        );
    }

    #[test]
    fn gen_data_pet_test() {
        let mut manager = DescriptorManager::default();
        Pet::_register(&mut manager);
        let (file_name, content) = manager.gen_data().into_iter().next().unwrap();
        assert_eq!(file_name, "pet.ts");
        assert_eq!(
            content.trim(),
            r#"export type = {cat: string}
    | {dog: string}
    | "None""#
        );
    }
}
