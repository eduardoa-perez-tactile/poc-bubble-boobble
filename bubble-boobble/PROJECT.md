# BubbleBoobble — project notes

This file is yours. `gameengine skills update` writes it once, when it is missing, and never
touches it again, so this is where everything specific to BubbleBoobble goes. `AGENTS.md`, `CLAUDE.md`
and the skills belong to the engine and are replaced when it updates them; put nothing project-specific there.

Agents read this file before `AGENTS.md`. Where the two disagree, this file wins for this project.
Agents do not write here on their own; they change this file only when someone asks them to add
specific guidance.

## The game

What it is, who it is for, and the core loop in a sentence or two.

## Conventions

Testing must use the Game Engine: `gameengine test`, recorded engine input/replays,
headless sessions, engine viewports, render probes and screenshots. Use the existing
editor through Game Engine APIs when appropriate.

Do not launch a standalone build, run `npm run desktop` or `desktop:*` probes, use
computer/browser automation, synthesize OS input, take focus, or control the user's
desktop to playtest. This is the user's workflow preference, not a missing permission
that should be requested or worked around. Only perform such actions when the user
explicitly asks for that specific action.

When engine coverage cannot establish an OS-level behavior, report that limitation
and continue with engine tests. Do not substitute a standalone play session.

## Decisions

Choices already made, and why, so agents do not reopen them.

## Links

Design docs, tickets, dashboards, the people to ask.
