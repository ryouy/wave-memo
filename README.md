# Wave Memo

Wave Memo is a Next.js prototype built around a simple idea:

> **Text should not always remain.**

Inspired by waves erasing writing on the shore, Wave Memo gently removes what you write.
At fixed intervals, a wave arrives.
The top line fades away.
The process repeats until nothing remains.

It is a memo experience designed around **impermanence**.

---

## A Quiet Choice

Would you like to let your thoughts drift away with the waves?

Wave Memo offers two intentional paths:

### Do not record

Random waves arrive and quietly wash your thoughts away.

### Record

If a thought should not be erased, preserve it —
not through built-in storage, but by intentionally taking a screenshot.

---

**Impermanence is the default.**
**Preservation is a conscious act.**

---

## Demo

[Try here!](https://wave-memo-vlgs.vercel.app/)

---

## Concept

Most note-taking tools prioritize storage, persistence, and accumulation.

Wave Memo explores the opposite direction.

You write.
Time passes.
The system erases.

Deletion is not abrupt. It is visible, gradual, and integrated into the interaction.

---

## Philosophy

Digital tools are optimized for retention.

Everything is saved. Indexed. Backed up. Synced.

Wave Memo questions that default.

Not every thought needs to be stored.
Not every sentence needs to survive.

Writing can be transient.
Disappearance can be intentional.

Wave Memo treats erasure as a designed behavior rather than a failure state.

---

## Features

- Periodic wave-triggered erasure
- Line-by-line fade-out animation
- Minimal writing interface
- No persistence layer
- Built with Next.js App Router

---

## Getting Started

Clone the repository:

```bash
git clone https://github.com/ryouy/wave-memo.git
cd wave-memo
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

---

## How It Works

1. Text is stored internally as a list of lines.
2. A timer triggers a periodic wave event.
3. When a wave arrives:
   - The first line is selected.
   - A fade-out animation is applied.
   - The line is removed from state.

4. The process continues until the memo is empty.

There is no undo. No archive. No history.

---

## Design Principles

- Impermanence over accumulation
- Deletion as interaction
- Calm visual motion
- Minimal cognitive load

---

## Tech Stack

- Next.js
- React
- TypeScript
- CSS animations
