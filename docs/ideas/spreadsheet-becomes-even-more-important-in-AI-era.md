---
description: An agent can hand you an answer anywhere. The spreadsheet is the only artifact that keeps the working, the controls and the report in the same object — which is what you need when the analyst is fast, confident and occasionally wrong.
---

# Spreadsheets become even more important in the AI era

You may disagree and you have strong points. The grid is forty years old, has no types, no tests and no version control worth the name, and a remarkable share of the finance industry's worst afternoons began with one. If you were designing from scratch the place where an AI does your analysis, you would not design this.

And yet it keeps winning, for a reason narrower than "everyone already has Excel".

## How do you check the math from LLMs

Imagine you have a bunch of numbers and you ask your agent to look into them. Your agent happily takes the job and gives you a result: you should have sold your company five years ago.

You are shocked. You want to verify it, or at least find where this absurd result comes from.

So what do you actually do?

If the answer came back as prose, you redo the work. A paragraph is not something you can check — it is something you either believe or you don't. You can ask for an explanation and you will get one, fluently, composed *after* the fact. It may even be the right story. You cannot tell, because the thing it describes no longer exists.

If it came back as a script you are better off, and this is the strong point I owe you. Code is inspectable, diffable, runnable. But code tells you what it *would* do, not what it did. To see the value that flowed through line 40 you have to run it, print, and run it again. The intermediates lived in a process that has already exited.

A spreadsheet has a property neither of those has: **the formula and the value sit at the same address, for every step, all the time.** Nothing is a temporary variable. Every number the calculation passed through on its way to the answer is still there, addressable, with its derivation attached.

That matters because of *how* you check a result, which is never by checking the result. You walk backwards. This total came from that range; the range covers one row more than you expected; the row is there because a lookup stopped matching in March. **The end is only where it became visible.**

Which is why the absurd answer is the lucky one. The dangerous answer is the plausible one — off by fifteen percent, in the direction you expected, for a reason nobody goes hunting for. Prose has no defence against this at all. A grid at least makes it **locatable**.

The grid is not good at this, to be clear. It will let a formula reference the wrong row and report it in the same confident black text as everything else. But *shows all of its working, permanently, at no extra cost* is a real property, and almost nothing else has it.

## A dashboard is where the controls are

Checking is the passive half. The moment you find the assumption you disagree with, you want to change it.

Ask a chat agent to redo the analysis at a 12% discount rate and you get a new answer. What you do not get is the *old* answer with one thing changed. Every re-ask is a fresh sample: the phrasing drifts, an intermediate rounds the other way, a judgement call lands differently this time. You cannot separate what moved because of your change from what moved because you asked twice.

**Re-prompting is not the same as changing a variable.** Holding everything else constant is most of what separates an experiment from an anecdote, and a conversation cannot hold anything constant.

Change a cell and exactly one thing changed. Everything downstream recomputes and nothing else does. That is not a convenience — it is the only reason the second run tells you anything.

A dashboard in a car is not a picture of the car. It is where the instruments and the controls sit together, so you can see a reading and act on it without leaving your seat. Which suggests what an agent's output should be. Not an answer, which is terminal and which you can only accept or reject, but **a model, which is a thing you can push on.**

It divides the labour correctly, too. The agent is fast, tireless and occasionally confidently stupid. You are slow at arithmetic and hold the only opinion in the room about which assumptions are defensible. A model puts each of you where you are strong: it builds the machine, you turn the knobs. An answer gives both jobs to the party that cannot be held responsible.

## And then somebody has to read it

The third thing gets forgotten because it looks like packaging.

The work has to go somewhere, usually to people who were not in the conversation — a partner, a board, a client, your own team. Nobody forwards a chat transcript and expects it to survive the trip.

The obvious answer is that everybody has a spreadsheet, which is true and boring. The interesting answer is that **the presentation and the computation are the same object.**

Normally they are not. A pipeline computes, a warehouse stores, a dashboard displays; the display sits downstream of the truth, so it can drift from it. Every analytics team has a chart that has been quietly wrong since someone changed a definition and not the query. The person reading it cannot tell. There is nothing in a chart to click.

In a workbook the number on the summary sheet *is* the formula. A reader who doubts it can follow it back without asking you, without access to anything else, in software they already know. They cannot do that to a number in a slide, a PNG, a BI dashboard or a chat log.

So the spreadsheet is the only common artifact that is the calculation, the control surface and the report at once. Everything else picks one and links to the others, and links rot.

## The analyst changed, not the tool

None of this is new. The grid had all three properties in 1985 and none of them were designed for a machine. What changed is who does the work.

When a person built the model, showing the working was a professional courtesy. If a number looked odd you asked them, and they remembered, and they could walk you through it — and if they could not, that told you something too.

The new analyst is faster than any of them, never tired, available at three in the morning, and will produce a confident, well-formatted, entirely wrong number without any of the tells a person gives off. It cannot reliably tell you what it did, because it has no privileged access to its own reasoning either.

Against that, showing the working stops being a courtesy.

> **If the agent hands you a number, your only option is to trust it.
> If it hands you a model, you get to disagree with it.**
