# xmlserde

[![MIT/Apache 2.0](https://img.shields.io/badge/license-MIT/Mit-blue.svg)](./LICENSE)

`xmlserde` is a tool for serializing or deserializing xml struct.
It is designed for [LogiSheets](https://github.com/proclml/LogiSheets), which is a spreadsheets application working on the browser.

You can check the usage in the `workbook` directory or [here](https://github.com/proclml/LogiSheets/crates/workbook).

## How to use `xmlserde`

`xmlserde` provides macros for you and in the most of cases, they are enough.

```rs
#[macro_use]
extern crate xmlserde;
```

### Deserialize

Start from deserializing would be easier to get closer to `xmlserde`.

Given the xml struct as below,

```xml
<person age ="16">Tom</person>
```

We can deserialize with these code:

```rs
#[derive(XmlDeserialize)]
pub struct Person {
    #[xmlserde(name=b"age", ty="attr")]
    pub age: u8,
    #[xmlserde(ty ="text")]
    pub name: String,
}

fn deserialize_person() {
    use xmlserde::xml_deserialize_from_str;

    let s = r#"<person age ="16">Tom</person>"#;
    let p = xml_deserialize_from_str(b"person", s).unwrap();
    assert_eq!(p.age, 16);
    assert_eq!(p.name, "Tom");
}
```

You are supposed to declare that where the deserializer to look for the values.

The available *type*s are **attr**, **text** and **child**. In the above example, we told program that diving into the tag named _"person"_ (xml*deserialize_from_str), and looking an attribute
whose key is *"age"\_ and that the content of the text element is the value of the field **name**.

Let's see an example of deserializing nested xml element.

```rs
#[derive(XmlDeserialize)]
pub struct Person {
    #[xmlserde(name=b"age", ty="attr")]
    pub age: u8,
    #[xmlserde(name = b"lefty", ty ="attr", default = "default_lefty")]
    pub lefty: bool,
    #[xmlserde(name = b"name", ty ="child")]
    pub name: Name,
}

#[derive(XmlDeserialize)]
pub struct Name {
    #[xmlserde(name = b"zh", ty ="attr")]
    pub zh: String,
    #[xmlserde(name = b"en", ty ="attr")]
    pub en: String,
}

fn deserialize_person() {
    use xmlserde::xml_deserialize_from_str;

    let s = r#"<person age ="16"><name zh="汤姆", en="Tom"/></person>"#;
    let p = xml_deserialize_from_str(b"person", s).unwrap();
    assert_eq!(p.age, 16);
    assert_eq!(p.name.en, "Tom");
    assert_eq!(p.lefty, false);
}

fn default_lefty() -> bool { false }
```

In the example above, it is declared that the value of **name** is a child whose tag is _"name"_. So the program would diving into `<name>` element and continue deserializing recursively.

Besides, we declare that if deserializer does not find the value of _lefty_
and its default value of **lefty** is false.

#### Vec

We support deserialize the fields whose type are `std::Vec<T: XmlDeserialize>`.

```rs
#[derive(XmlDeserialize)]
pub struct Pet {
    // Fields
}

#[derive(XmlDeserialize)]
pub struct Person {
    #[xmlserde(name = b"petCount", ty = "attr")]
    pub pet_count: u8,
    #[xmlserde(name = b"pet", ty = "child")]
    pub pets: Vec<Pet>
}
```

When the deserializer find the _pet_ element, and it will know that this is an element of **pets**. You can even assign the capacity of the `Vec` with following:

```
#[xmlserde(name = b"pet", ty="child", vec_size=3)]
```

If the capacity is from an **attr**, you can:

```
#[xmlserde(name = b"pet", ty="child", vec_size="pet_count")]
```

#### enum:

```rs
#[derive(XmlSerialize, XmlDeserialize)]
enum TestEnum {
    #[xmlserde(name = b"testA")]
    TestA(TestA),
    #[xmlserde(name = b"testB")]
    TestB(TestB),
}
```

#### Unparsed

Sometimes we don't care about some xml element and we just want to keep them for serializing.
We provide a struct `Unparsed`.

```rs
#[derive(XmlDeserialize)]
pub struct Person {
    #[xmlserde(name = b"educationHistory", ty = "child")]
    pub education_history: Unparsed,
}
```

### Serialize

It is almost the same as deserializing. But there are some features you
should pay attention to.

- default value will skip serializing. If it is a **struct**,
  it should impl `Eq`.
- If a struct has no **child** or **text**, the result of serializing will
  look like this:
  ```xml
  <tag attr1="value1"/>
  ```

### Custom xmlserde

`xmlserde` provides the trait `XmlSerialize` and `XmlDeserialize`, you
can define a struct's behavior by implementing them.
