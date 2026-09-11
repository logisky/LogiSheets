---
description: Rust built the best correction loop in mainstream programming years before anyone was designing for agents. That accident tells you what "AI-native" actually means, and why software that is good for an agent is good for a beginner.
---

# What is real AI-native?

So much software is AI-native now. But what is AI-native?

A good place to start the discussion is Rust. Yes, *Rust*.

## The most suitable language for the AI era?

I am not kidding. Rust has some really nice properties for AI agents:

- Its compiler teaches you patiently when your code is not working.
- And if the compiler says "yes", your code has already avoided some serious mistakes, like dangling pointers.

Maybe Rust is not the most suitable. There is far less of it than Python in any training set, and you can watch a model circle the same lifetime for twenty minutes. But it has **the best correction loop of any mainstream language**. When the agent is wrong it finds out at once, in a message clear enough to act on, and it can ask again before anything is committed. The *compiler* carries the burden of knowing what "wrong" means, not the agent.

But wait — was that Rust's goal? Obviously not. Rust 1.0 was released in May 2015, seven years before ChatGPT cracked the world open and nearly ten years before Claude Code changed the software industry.

Here comes an intriguing question: how did Rust foresee that AI was coming?

It did not. Rust was never aiming at agents. It was aiming to be correct, and to tell you the moment you were not. **Nobody has to foresee AI to want that.** You only have to take being wrong seriously.

## Three kinds of operator

To see why, forget AI for a moment and ask who operates software at all.

**The human user.** They want a UI — buttons, menus, a canvas. Something to look at and point at.

**The script.** It wants an API — a CLI flag, an SDK call, an HTTP endpoint. Something with a name, arguments and a return value. It never looks at your beautiful button.

**The AI.** The new arrival, and the one almost every product is now busy building a third interface for.

But an agent handed a task reaches for the CLI, calls the SDK, writes twenty lines of Python. **AI writes scripts.** And a button is only a function call with a picture on it, so the UI is a client of the API too — whether or not anyone outside can reach it. **All three arrive at the same interface.**

So ask what a good API actually gives them. Not merely that some call exists. It tells you **which call to make**. Each operation does one thing, its name says which thing, and operations with nothing to do with each other are kept apart. That is what lets anyone walk up to a system they have never seen and work out where to start.

Now notice that this is also the whole job of a good UI. A menu is a classification. A screen is a boundary. A product is easy to navigate when somebody decided what the nouns were and which actions belonged to which one, and it is a maze when nobody did — you can see the mess as forty buttons that half overlap. The UI is that decision drawn in pixels. The API is the same decision written in names.

So there are not three design problems here. **There is one.** Solve it and the person finds the right button, the script finds the right endpoint, and the agent picks the right tool, all out of the same work. They are *three doors into one room*.

Which means AI-native is not a category. **It is a name people give to software that finally got its API right.**

## AI-native? No, just human-friendly

Ironically, AI stands for artificial intelligence. Much of this software is only pursuing friendship with AI, not the real intelligence.

Looking back at those features that give AI such an advantage, they were doing humans a favour all along.

That shared interface was the easy half. Nobody has a complete picture of your software — not the person, not the script, not the agent — so everybody gets it wrong, constantly. Which is why the interesting question is not what your product does when the operator gets it right. Ask three things about what happens when they get it wrong.

**Can they check their own work?** You can run the Rust compiler whenever you like and get an answer about the whole program in seconds. Cheap, on demand, complete. That is what closes the loop: act, ask, correct.

Now change one cell in a spreadsheet. What do you run to find out whether you just broke something? The workbook recalculates, shows you a number, and a wrong number looks exactly like a right one. `#REF!` turns up only where a formula could not run at all; the common failure is quieter — a total that shifted, a lookup that now misses, a range that stopped covering the last row. There is no `cargo check` for a workbook.

Most software is in that position. You act, and you find out in production, when a customer notices. An agent on that product is not being careless when it goes wrong. **It has no way to find out.**

**When they are wrong, can they put it right?** Compare `Invalid input.` with `Expected a date like 2024-01-31, got "31/01/2024".` The second is better for an AI. Obviously. Now ask who else it is better for, and notice you did not have to think about it. Rust's compiler names the borrow, shows where it began and ended, and often writes the fix. That was built because a human was stuck. An explanation good enough for a stuck human is good enough for a machine.

**Is it hard to be wrong in the first place?** Best of all is the mistake you cannot make. Rust does not help you debug dangling pointers; it removes the category. The guarantee is not advice, and not a lint you can ignore.

Ask an agent to analyse the cash flow statement in a workbook, and watch what it has to do first: work out which cells *are* the cash flow statement, which rows are line items, which columns are periods, whether that blank row is a separator or a missing figure. It will get this mostly right. In a financial model, **mostly right is the worst outcome there is** — nobody notices, and the number is wrong.

None of that guessing is necessary. It happens because the file never said what it contained. Let the sheet declare *this is a cash flow statement, these are its line items, these are its periods*, and inference becomes lookup — and the person who opens the file next finds a table that says what it is.

This is the expensive one: decided early, paid for in flexibility. It is also the only thing that works on something confident, fast, and entirely willing to do something stupid. No prompt fixes that. You make the space smaller until the confident wrong move cannot be written. The borrow checker does not persuade you. It **refuses** you.

## Real intelligence

Software that is good to an agent turns out to be good to a person. You can see what it does, and you can act without fear of breaking something quietly. That is not an AI feature. That is **software you can trust**.

There is a catch, and Rust proves it. Software like this is hard to learn. For thirty years that cost decided who won: the forgiving tool beat the strict one almost every time, because *being easy was worth more than being correct*.

That is over. Not because Rust got easier, but because **you no longer have to learn it before you can use it**. The agent does the work while you watch. You see the same error fixed twenty times and it stops being strange. Ask, and it will explain. You learn on the way now, instead of before you start.

So perhaps that is what AI-native really means. Not software with AI bolted on, but software that can finally **afford to be strict**: to check, to explain, to refuse, without driving away every user who would once have given up.

And it turns the question around. If you are no longer paying the learning cost by yourself, **why would you still pick the tool that is easier to get wrong?** There are real answers — libraries, speed of writing — but *it is hard to learn* is no longer one of them.
