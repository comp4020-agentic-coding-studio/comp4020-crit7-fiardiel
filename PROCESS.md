# Process overview

## What I built

A replacement for the part of ANUHub course selection that annoys me most: adding
courses one at a time. It's one page where you search, tick up to four
courses and enrol in all of them with one button. It enforces ANU's
four-course load and COMP4020's permission code, and it's saved in SQLite so
it survives a reload. `README.md` says what good means here and what I left
out.

## How I got here

I started from the problem, not a feature list. When the agent asked which ANU
system to pick, I told it:

> the one that annoys me the most is when you wanna pick a course, but you have
> to press add, search, and then confirm first, and you do that one course by
> one course, it's really annoying and the interface is too small

Its first proposal also included program selection. I cut it down:

> i wanna only slice, and mainly the course picking problem

From there I agreed a design (one form with a checkbox per course, search that
hides cards so ticks survive, one POST for the whole batch) and had it written
down as a spec,
[`3d105d1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/3d105d1),
then a step-by-step plan,
[`a521199`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/a521199),
before any code.

The build was test first. The enrolment tests in `spec/enrolment.test.ts` were
written and run red before the routes existed, then went green in
[`24f4b94`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/24f4b94),
which I deployed straight away so there was a live version well before the
cutoff. The roomy layout, search and tray followed in
[`1142c7e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/1142c7e).

Two kinds of correction shaped the rest. A fresh review agent found that
pressing Enter in the search box submitted the enrol form, so searching could
enrol you. A test reproduced it before the fix in
[`dd21db3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/dd21db3).
The bigger corrections came from me using the site and checking it against how
ANU actually works:

> it doesn't follow the anu rule, so when you pick a course, it's like you can
> pick any course, but in anu, especially if you're international student, you
> can only pick 4 courses [...] do we just disregard the prerequisites as it's
> a scope creep, or what should we do?

The four-course limit went in, enforced on the server and refusing an
over-limit batch as a whole, alongside an ANU black-and-gold theme and a real
header, in
[`a01ea60`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/a01ea60).
Prerequisites I deliberately left out: doing them properly needs a transcript
and accurate prerequisite data, and doing them badly would block students from
courses they're allowed into. The last addition was a permission code on
COMP4020, which is checked on the server and never sent to the page:
[`c0d0d39`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-fiardiel/commit/c0d0d39).

I knew it was right in two ways. `pnpm check` (typecheck, the starter's
invariants and accessibility floor, and my 47 contract tests) was green before
every commit, and each rule the agent added started as a failing test. The
parts no test can judge, whether it's actually nicer than ANUHub, I checked by
using the deployed site myself, which is how I found the four-course and
About-page problems. `CLAUDE.md` records the rules I held the agent to.
