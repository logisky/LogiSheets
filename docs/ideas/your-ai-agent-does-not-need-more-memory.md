---
description: Memory is for intent — what the user wants, which is recorded nowhere. Everything else the software should be able to answer for itself, and most agent memory is standing in for software that cannot.
---

# Your AI agent doesn't need more memory

Ask an agent whether you are free on Monday afternoon, and it opens your calendar. It does not need to recall what you said last week. It does not need a vector database of your past conversations. The calendar already knows.

Ask it to fix a bug, and it runs `git status`, reads the files you touched, runs the tests, reads the error. It has no idea what you were doing yesterday, and it doesn't need to. The repository is the source of truth.

So far this is obvious. It stops being obvious when the state gets large.

## A novel with a thousand chapters

You have written 1,000 chapters at five thousand words each. You ask: *what should happen next?*

**Read everything.** Five million words through a context window, summarised and compacted until the parts that mattered are gone. Expensive, and lossy in exactly the places you cannot check.

**Read the last few chapters.** Pull the characters out of them, search the rest of the book for their appearances, reconstruct enough to continue. Clever — but why three chapters? Why not ten, or fifty? Three is not a number anyone worked out. It is a number the agent made up, because nobody told it what it needed.

**Build a memory system.** Keep notes as you go: *Alice betrayed Bob in chapter 432. Bob wants the throne. The northern kingdom has never forgiven the empire. The user wants Alice to forgive Bob eventually.* Retrieve whichever ones look relevant, then write.

The third answer sounds like architecture, which is probably why it keeps getting built. Hold on to those four notes — three of them are a mistake and one is the only honest answer on this page. The mistake: **the novel is sitting right there on the disk.** A note about chapter 432 can go stale; chapter 432 cannot.

## Someone already built the alternative

The obvious fix is software that knows it is holding a novel rather than a pile of text: characters, relationships, locations, a timeline, arcs, plot points, scenes. A name in the prose is a reference to a character, not a string that happens to spell "Alice". The application knows who appears in which scene, which arc is open, which plot points have already fired.

That is not a thought experiment. [yWriter](https://spacejock.com/yWriter7.html) has done it since 2003, written by a novelist for his own use. [World Anvil](https://www.worldanvil.com/) cross-links characters, locations, religions and timelines into one world. [Plottr](https://plottr.com/) makes every story beat a thing you can name and reuse. [Scrivener](https://www.literatureandlatte.com/scrivener/overview) keeps the character sheets in the same project as the manuscript. None of it was built for an AI. In 2003 there was nothing to build it for.

Then the models arrived, and the tools that already had the structure barely had to move. [Novelcrafter's Codex](https://www.novelcrafter.com/features/codex) — characters, locations, items, lore, the relations between them, aliases, and *progressions* recording how a character changes across the book — is a story bible that also goes to the model as context on every request. [Sudowrite's Story Bible](https://sudowrite.com/blog/story-bible-template/) chains synopsis into characters into worldbuilding into outline, and feeds the chain into generation. Neither had to invent the model. They had one lying around.

So the interesting part is not that the structured model is possible. It is that **the people who built it were not thinking about AI at all.** They were solving a human problem, and what came out the other end is the thing an agent can actually use. You do not have to foresee AI to want your software to know what it contains.

And it is worth asking why the calendar and the repository were easy, because it was not simplicity. **Something else had already forced them to be explicit.** A meeting cannot exist without a start time; a compiler will not run until you say what the module imports. Nobody structured those for an agent either — it was the price of the thing working at all. Prose has no such gate. A thousand chapters will sit there quite happily without ever once saying who Alice is, which is exactly why the guessing starts.

Which is the question to ask about a memory system before building one: is it holding what the user wants, or is it standing in for **software that cannot be asked what is true right now?**

## State, memory, knowledge

Which only works if you keep apart three things that usually get filed under one word.

**State** is what is true *right now*: the current branch, the open document, the selected cells, the current story node. It belongs to the software, and the software should be able to hand it over on demand — no inference, no reconstruction.

**Memory** is the one people get wrong, and the four notes settle it. Three of them are *in the manuscript*: chapter 432 records the betrayal, and a book that set up the quarrel with the north set it up on the page. Those don't want remembering, they want reading. The fourth — *the user wants Alice to forgive Bob eventually* — is not a fact about the novel at all. It is a fact about the person writing it, concerning a chapter that does not exist yet.

**Memory is for intent.** Nothing else qualifies. The past is observable: it already happened, and something recorded it. What the user *wants* has not happened, is written nowhere, and no amount of reading gets it back — you could take in all five million words and still not know that Alice is meant to forgive him.

Which is why memory stays small if you let it. Once the intent is clear, the agent needs nothing else handed to it; it goes and looks — who Alice is, what she did in 432, where the plot stands. **Memory supplies the goal, state supplies the picture.** Keep the two apart and memory holds only what it should, which matters because every line in it is a claim nobody is checking.

**Knowledge** is what exists in the world but isn't yours: documentation, papers, the web. This is the one place retrieval genuinely belongs, and even here embeddings are an option rather than the default. **Retrieval is a technique, not an architecture.**

None of which is really for the agent's benefit. An agent that can look things up is merely cheaper to run. The difference shows up in what it stops doing to the person: asking what you already told the file, rebuilding your project out of your last three messages and getting it subtly wrong, treating you as its context window. You supply the one thing nobody else can — what you want — and it goes and finds the rest.

And the structure that makes that possible was never an AI feature. Software that can say what it contains is easier to search, to navigate, and to hand to somebody else, whether or not the next thing to open it has eyes.

## Don't remember what you can observe

Which turns the usual agent loop around. *Remember → retrieve → infer → act* becomes **observe → understand → act → verify**.

This is why coding agents work as well as they do with almost no memory system at all. Files, git, tests, compiler errors, processes, CI — a repository will tell you its own state, completely and on demand, as often as you care to ask. The agent doesn't remember the codebase. It looks.

Which gives a short list of things to reach for before reaching for memory:

> **Don't remember what you can observe.**
> **Don't retrieve what you can query.**
> **Don't infer what you can just write down.**
> **Don't guess what you can ask the user.**

Each one moves work out of the agent and into the software, where it can be correct instead of probable.

And the last one is the memory problem wearing a different hat. Intent is the only thing you genuinely cannot look up, which leaves exactly two honest ways to get it: ask for it, or remember it from the last time you asked.

## The hardest case is the one everybody uses

All of which is easy in a repository, where everything is already legible to whoever asks. It is much harder in the software most of the working world opens every morning.

Give the spreadsheet its due: the dependency graph is right there in the open, and any cell will tell you exactly what it depends on. And still the file cannot say what any of it *means*. `G12` is a location, not an object — insert a row above it and the same number answers to a different name. Nothing says that this rectangle is a table, that this row is its header, that this blank row is a separator rather than a missing figure.

The oldest convention in financial modelling makes the point: **blue text is an input you may change, black is a formula you may not.** Close to the most important thing you can know about a cell, and it is carried by a font colour — the same channel you use to make a heading look nice. A person decodes it at a glance and never notices they did; anything else is guessing, and nine times in ten is no comfort when nobody checks the tenth. **The grid knows everything about its cells and nothing about its contents.**

Which is not really a spreadsheet problem. It is any software whose model lives somewhere the file cannot see — a folder tree where the hierarchy *is* the schema, a board where "Done" means whatever the team once agreed. And it is not fixed by adding an API. You cannot bolt `describe_selection()` onto a grid and get an answer back, because nobody ever told the grid. Something in the file itself has to be able to say *this is a table, these are its fields, this column is money, this cell is an assumption*.

Which gives a test that is uncomfortably simple:

> **If your agent needs an elaborate memory system just to know what is going on, the software never exposed enough of itself.**
