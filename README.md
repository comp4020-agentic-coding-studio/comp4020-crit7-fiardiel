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
- **ANU's four-course load.** A semester is four courses (24 units), and for
  international students it's exactly four. The server refuses any batch that
  would take you past four, all or nothing, so you're never left half
  enrolled, and the page tells you why. While you pick, the tray shows how
  many you'll have out of four.
- **Permission codes.** Some ANU courses need a code from the convenor before
  you can enrol. COMP4020 is modelled that way: its card asks for the code,
  the server checks it (the code is never sent to the page), and a missing or
  wrong code refuses the whole batch with a message saying why. It's the only
  course set up like this.

What's enforced by tests (`spec/enrolment.test.ts`): enrolling in several
courses in one request, and those enrolments surviving a reload; no double
enrolments; dropping a course; ignoring fake course codes; the four-course
limit, including refusing an over-limit batch as a whole and saying why; the
labelled search box, and Enter in it never enrolling you; and enrolled courses
not being pickable again.

What's a judgement call: whether this is actually better than ANUHub, and
whether the page feels roomy rather than cramped. That's for the crit.

## What I chose not to build

**Prerequisites.** This was the hardest thing to leave out, because ANU does
block you from courses you haven't met the prerequisites for. Doing it
properly needs a record of what you've passed, accurate prerequisite data for
every course, and rules like "this course or that one". Doing it badly would
block real students from courses they're allowed into, which is worse than not
checking at all.

**Underloading.** Taking fewer than four courses (after a summer course, say)
needs approval in the real system, so the app shows how far you are from four
but doesn't try to model the approval.

Also out: logging in, choosing a program and checking its requirements,
timetable clashes, semesters and class capacity. Each is a real part of course
selection, but none of them is the add, search, confirm loop this prototype is
about. Timetable and Grades appear in the header only to show where this slice
would sit; they aren't built. There's one anonymous student, and the course
list is a small set of real ANU courses.
