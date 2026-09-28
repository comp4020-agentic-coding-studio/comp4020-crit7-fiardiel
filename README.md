# ANU course picker

ANUHub makes you add courses one at a time: press add, search, confirm, then
start again for the next one, all inside a cramped panel. This is the slice of
course selection I wish existed instead: one roomy page where you search, tick
as many courses as you want, and enrol in all of them with a single button.
Your enrolments are saved, so they're still there when you come back.

## What good looks like here

Good means picking a semester's courses takes one confirm, not one per course.
I compared it against the ANUHub flow I actually use every semester, and
against the Programs and Courses site, which is hard to learn but shows a lot
of information at once. That's what I wanted here: room to read a course
before you pick it.

The decisions that came out of that:

- **One confirm for many courses.** Every ticked course goes in one request.
- **Search keeps your ticks.** Searching hides the courses that don't match
  instead of reloading, so what you ticked before a search is still ticked
  after it.
- **Room to read.** Each course is a card with its code, title, units and a
  one-line description, in a grid that uses the whole screen.
- **A load warning that doesn't block you.** Going above 24 units (a
  full-time load) shows a warning, but you can still enrol.

What's enforced by tests (`spec/enrolment.test.ts`): enrolling in several
courses in one request, and those enrolments surviving a reload; no double
enrolments; dropping a course; ignoring fake course codes; the labelled
search box; enrolled courses not being pickable again; and the load warning.

What's a judgement call: whether this is actually better than ANUHub, and
whether the page feels roomy rather than cramped. That's for the crit.

## What I chose not to build

Logging in, choosing a program and checking its requirements, timetable
clashes, prerequisites, semesters and class capacity. Each is a real part of
course selection, but none of them is the add, search, confirm loop this
prototype is about. There's one anonymous student, and the course list is a
small set of real ANU courses.
