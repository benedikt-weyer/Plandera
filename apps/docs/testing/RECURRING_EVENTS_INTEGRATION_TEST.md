# Recurring Events - Manual Integration Test Guide

This document provides comprehensive manual integration test scenarios for recurring event functionality in Streamline Scheduler.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Test Environment Setup](#test-environment-setup)
- [Part 1: Regular Recurring Events](#part-1-regular-recurring-events)
  - [Moving Events](#moving-events)
  - [Editing Events](#editing-events)
  - [Deleting Events](#deleting-events)
- [Part 2: Recurring Group Events](#part-2-recurring-group-events)
  - [Moving Group Events](#moving-group-events)
  - [Editing Group Events](#editing-group-events)
  - [Deleting Group Events](#deleting-group-events)
- [Test Coverage Matrix](#test-coverage-matrix)

---

## Prerequisites

### Required Test Data
- At least one calendar created
- User must be logged in
- Browser console open for debugging if issues arise

### Test Event Templates

**Daily Recurring Event:**
- Title: "Daily Standup"
- Start Time: 09:00 AM
- Duration: 30 minutes
- Recurrence: Daily for 14 days

**Weekly Recurring Event:**
- Title: "Weekly Review"
- Start Time: 2:00 PM
- Duration: 1 hour
- Recurrence: Weekly (every Monday) for 8 weeks

**Recurring Group Event:**
- Title: "Sprint Planning"
- Start Time: 10:00 AM
- Duration: 2 hours
- Recurrence: Bi-weekly for 6 occurrences
- Has linked tasks or sub-events

---

## Part 1: Regular Recurring Events

### 1.1 Moving Events

#### Test 1.1.1: Move First Event (Root) via Drag & Drop
**Setup:** Create a daily recurring event with 7 occurrences

**Steps:**
1. Navigate to calendar week view
2. Locate the first occurrence of the recurring event
3. Click and drag the event to a different time slot on the same day
4. Release the mouse button

**Expected Outcomes:**
- [ ] Dialog appears with options: "Modify only this", "Modify this and future occurrences", "Modify all occurrences"
- [ ] Select "Modify only this" → Only first occurrence moves, others remain unchanged
- [ ] Select "Modify this and future occurrences" → All occurrences move (since this is root)
- [ ] Select "Modify all occurrences" → All occurrences move
- [ ] No orphaned events remain
- [ ] Event IDs are preserved correctly

**Validation:**
- Check that recurrence_master_id relationships are maintained
- Verify that moved events still show recurrence indicator icon
- Confirm calendar refreshes without errors

---

#### Test 1.1.2: Move First Event (Root) via Edit Dialog
**Setup:** Use the same event from Test 1.1.1

**Steps:**
1. Click on the first occurrence
2. In edit dialog, change the start time
3. Click Save

**Expected Outcomes:**
- [ ] Same dialog options appear as in Test 1.1.1
- [ ] Each selection produces the same results as drag & drop
- [ ] Time validation works (cannot set invalid times)
- [ ] Changes persist after calendar navigation

---

#### Test 1.1.3: Move Middle Event via Drag & Drop
**Setup:** Create a weekly recurring event with 6 occurrences, select the 3rd occurrence

**Steps:**
1. Drag the 3rd occurrence to a different time/day
2. Test each dialog option separately:

**Option A: "Modify only this"**
- [ ] Only the 3rd occurrence moves
- [ ] A new detached event is created
- [ ] Original series continues without gap at position 3
- [ ] Moved event loses recurrence indicator
- [ ] Original event at position 3 still exists in original series

**Option B: "Modify this and future occurrences"**
- [ ] 3rd occurrence and all after it (4th, 5th, 6th) move
- [ ] A new recurrence series is created starting from the 3rd occurrence
- [ ] Original series now only contains occurrences 1 and 2
- [ ] New series has its own recurrence_master_id
- [ ] Both series maintain their recurrence indicators

**Option C: "Modify all occurrences"**
- [ ] All occurrences (1-6) move by the same time delta
- [ ] Original recurrence_master_id is preserved
- [ ] All events maintain their relative positions
- [ ] No new series is created

---

#### Test 1.1.4: Move Middle Event via Edit Dialog
**Setup:** Use the same scenario as Test 1.1.3

**Steps:**
1. Click on 3rd occurrence
2. Change start time in edit dialog
3. Test each save option

**Expected Outcomes:**
- [ ] Results match Test 1.1.3 exactly
- [ ] End time adjusts automatically if duration is preserved
- [ ] Validation prevents overlapping with other events (optional, based on settings)

---

#### Test 1.1.5: Move Last Event via Drag & Drop
**Setup:** Create a daily recurring event with 5 occurrences, select the 5th (last)

**Steps:**
1. Drag the last occurrence to a different time/day
2. Test each dialog option:

**Option A: "Modify only this"**
- [ ] Only the 5th occurrence moves
- [ ] Creates a detached single event
- [ ] Original series continues with occurrences 1-4
- [ ] Original occurrence 5 still exists in series

**Option B: "Modify this and future occurrences"**
- [ ] Only the 5th occurrence moves (no future occurrences exist)
- [ ] Creates a new single-event "series" with one occurrence
- [ ] Original series contains occurrences 1-4

**Option C: "Modify all occurrences"**
- [ ] All 5 occurrences move by the same time delta
- [ ] Recurrence_master_id preserved
- [ ] All events maintain relative positions

---

#### Test 1.1.6: Move Last Event via Edit Dialog
**Setup:** Use same scenario as Test 1.1.5

**Steps:**
1. Click on 5th occurrence
2. Change date and time in edit dialog
3. Test each save option

**Expected Outcomes:**
- [ ] Results match Test 1.1.5 exactly
- [ ] Date picker works correctly
- [ ] Time validation functions properly

---

### 1.2 Editing Events

#### Test 1.2.1: Edit First Event (Root) - Change Title
**Setup:** Create a weekly recurring event with 4 occurrences

**Steps:**
1. Click on first occurrence
2. Change title from "Weekly Review" to "Team Sync"
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Only first occurrence has new title
- [ ] Creates a detached event
- [ ] Original series continues with original title for occurrences 2-4
- [ ] First occurrence in original series remains with original title

**Option B: "Modify this and future occurrences"**
- [ ] All occurrences have new title (since this is root)
- [ ] recurrence_master_id preserved
- [ ] All events in series updated

**Option C: "Modify all occurrences"**
- [ ] All occurrences have new title
- [ ] recurrence_master_id preserved
- [ ] All events in series updated

---

#### Test 1.2.2: Edit First Event (Root) - Change Duration
**Setup:** Use the same event, reset if modified

**Steps:**
1. Click on first occurrence
2. Change duration from 1 hour to 2 hours
3. Test each save option

**Expected Outcomes:**
- [ ] Results mirror Test 1.2.1 but with duration change
- [ ] End time calculates correctly
- [ ] No overlap issues

---

#### Test 1.2.3: Edit First Event (Root) - Change Recurrence Pattern
**Setup:** Daily recurring event with 7 occurrences

**Steps:**
1. Click on first occurrence
2. Change recurrence from "Daily" to "Every 2 days"
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Should show error or warning (cannot change recurrence of single instance)
- [ ] No changes applied

**Option B: "Modify this and future occurrences"**
- [ ] All occurrences recalculated with new pattern
- [ ] May result in different number of occurrences
- [ ] Dates adjusted accordingly

**Option C: "Modify all occurrences"**
- [ ] All occurrences recalculated with new pattern
- [ ] Same results as Option B for root event

---

#### Test 1.2.4: Edit Middle Event - Change Title
**Setup:** Daily recurring event with 10 occurrences, select 5th

**Steps:**
1. Click on 5th occurrence
2. Change title
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Only 5th occurrence has new title
- [ ] Creates detached event
- [ ] Original series continues with original title (1-10)

**Option B: "Modify this and future occurrences"**
- [ ] Occurrences 5-10 have new title
- [ ] New series created with new recurrence_master_id
- [ ] Original series (1-4) keeps original title
- [ ] Split happens correctly

**Option C: "Modify all occurrences"**
- [ ] All occurrences (1-10) have new title
- [ ] Original recurrence_master_id preserved

---

#### Test 1.2.5: Edit Middle Event - Change Multiple Fields
**Setup:** Weekly recurring event with 8 occurrences, select 4th

**Steps:**
1. Click on 4th occurrence
2. Change title, description, duration, and color
3. Test each save option

**Expected Outcomes:**
- [ ] All changed fields apply according to selected option
- [ ] Behavior matches Test 1.2.4 pattern
- [ ] No data loss for any field

---

#### Test 1.2.6: Edit Middle Event - Add/Remove Linked Task
**Setup:** Recurring event with linked task, 6 occurrences, select 3rd

**Steps:**
1. Click on 3rd occurrence
2. Add a new linked task OR remove existing linked task
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Only 3rd occurrence has modified task links
- [ ] Other occurrences maintain original links
- [ ] Task list updates correctly

**Option B: "Modify this and future occurrences"**
- [ ] Occurrences 3-6 have modified task links
- [ ] Occurrences 1-2 maintain original links
- [ ] New series created

**Option C: "Modify all occurrences"**
- [ ] All occurrences have modified task links
- [ ] Task list synchronized across all

---

#### Test 1.2.7: Edit Last Event - Change Title
**Setup:** Daily recurring event with 5 occurrences, select 5th

**Steps:**
1. Click on 5th occurrence
2. Change title
3. Test each save option

**Expected Outcomes:**
- [ ] Option A: Only 5th changes, creates detached event
- [ ] Option B: Only 5th changes (no future occurrences)
- [ ] Option C: All 5 occurrences change
- [ ] Results consistent with previous tests

---

#### Test 1.2.8: Edit Last Event - Change Time and Date
**Setup:** Use same event as Test 1.2.7

**Steps:**
1. Click on 5th occurrence
2. Change both date and time
3. Test each save option

**Expected Outcomes:**
- [ ] Results match Test 1.2.7 pattern
- [ ] Date and time both update correctly
- [ ] Calendar view refreshes properly

---

### 1.3 Deleting Events

#### Test 1.3.1: Delete First Event (Root)
**Setup:** Weekly recurring event with 6 occurrences

**Steps:**
1. Click on first occurrence
2. Click delete button
3. Test each delete option:

**Option A: "Delete only this"**
- [ ] First occurrence deleted
- [ ] Original series continues with occurrences 2-6
- [ ] Second occurrence does NOT become new root
- [ ] Gap exists at first position

**Option B: "Delete this and future occurrences"**
- [ ] All occurrences deleted (since this is root)
- [ ] Entire series removed from calendar
- [ ] No orphaned events remain

**Option C: "Delete all occurrences"**
- [ ] All occurrences deleted
- [ ] Entire series removed from calendar
- [ ] No orphaned events remain

---

#### Test 1.3.2: Delete Middle Event
**Setup:** Daily recurring event with 10 occurrences, select 5th

**Steps:**
1. Click on 5th occurrence
2. Click delete button
3. Test each delete option:

**Option A: "Delete only this"**
- [ ] Only 5th occurrence deleted
- [ ] Occurrences 1-4 remain unchanged
- [ ] Occurrences 6-10 remain unchanged
- [ ] Gap exists at 5th position in series
- [ ] recurrence_master_id unchanged for remaining events

**Option B: "Delete this and future occurrences"**
- [ ] Occurrences 5-10 deleted
- [ ] Occurrences 1-4 remain
- [ ] Original series effectively truncated
- [ ] No new series created

**Option C: "Delete all occurrences"**
- [ ] All occurrences (1-10) deleted
- [ ] Entire series removed
- [ ] Calendar updates correctly

---

#### Test 1.3.3: Delete Last Event
**Setup:** Weekly recurring event with 4 occurrences, select 4th

**Steps:**
1. Click on 4th occurrence
2. Click delete button
3. Test each delete option:

**Option A: "Delete only this"**
- [ ] Only 4th occurrence deleted
- [ ] Occurrences 1-3 remain unchanged
- [ ] Series effectively shortened

**Option B: "Delete this and future occurrences"**
- [ ] Only 4th occurrence deleted (no future occurrences)
- [ ] Occurrences 1-3 remain
- [ ] Same result as Option A

**Option C: "Delete all occurrences"**
- [ ] All occurrences (1-4) deleted
- [ ] Entire series removed

---

#### Test 1.3.4: Delete Multiple Individual Occurrences
**Setup:** Daily recurring event with 7 occurrences

**Steps:**
1. Delete 2nd occurrence (select "Delete only this")
2. Delete 4th occurrence (select "Delete only this")
3. Delete 6th occurrence (select "Delete only this")

**Expected Outcomes:**
- [ ] Occurrences 1, 3, 5, 7 remain
- [ ] Gaps exist at positions 2, 4, 6
- [ ] Remaining events maintain recurrence_master_id
- [ ] Calendar displays correctly with gaps

---

#### Test 1.3.5: Delete Then Recreate
**Setup:** Weekly recurring event with 5 occurrences

**Steps:**
1. Delete 3rd occurrence (select "Delete only this")
2. Manually create a new event at the same date/time as deleted occurrence
3. Verify it's a separate event

**Expected Outcomes:**
- [ ] New event is independent (no recurrence_master_id)
- [ ] Original series continues with gap at position 3
- [ ] No conflicts or duplicates
- [ ] Both events coexist properly

---

## Part 2: Recurring Group Events

**Note:** Group events have linked tasks, sub-events, or participants that should be handled as a unit.

### 2.1 Moving Group Events

#### Test 2.1.1: Move First Group Event (Root) via Drag & Drop
**Setup:** Create a bi-weekly recurring event with 4 occurrences, each with 2 linked tasks

**Steps:**
1. Drag first occurrence to new time/day
2. Test each dialog option:

**Option A: "Modify only this"**
- [ ] Only first occurrence moves
- [ ] Linked tasks remain associated
- [ ] Tasks' due dates update if tied to event date
- [ ] Creates detached group event
- [ ] Original series continues (1-4)

**Option B: "Modify this and future occurrences"**
- [ ] All occurrences move (since this is root)
- [ ] All linked tasks maintain associations
- [ ] All task due dates update accordingly
- [ ] Group structure preserved

**Option C: "Modify all occurrences"**
- [ ] All occurrences move
- [ ] All linked tasks maintain associations
- [ ] All task due dates update accordingly
- [ ] recurrence_master_id preserved

---

#### Test 2.1.2: Move First Group Event (Root) via Edit Dialog
**Setup:** Use same setup as Test 2.1.1

**Steps:**
1. Click on first occurrence
2. Change date/time in edit dialog
3. Test each save option

**Expected Outcomes:**
- [ ] Results match Test 2.1.1
- [ ] Task links visible in edit dialog
- [ ] All linked tasks update correctly

---

#### Test 2.1.3: Move Middle Group Event via Drag & Drop
**Setup:** Weekly recurring group event with 6 occurrences, each with 3 linked tasks, select 3rd

**Steps:**
1. Drag 3rd occurrence to new time/day
2. Test each dialog option:

**Option A: "Modify only this"**
- [ ] Only 3rd occurrence moves
- [ ] 3 linked tasks remain with this occurrence
- [ ] Tasks detach from original series
- [ ] Original series continues without gap
- [ ] Moved occurrence loses recurrence indicator

**Option B: "Modify this and future occurrences"**
- [ ] Occurrences 3-6 move
- [ ] New series created with these occurrences
- [ ] Linked tasks split: tasks for 3-6 move with new series
- [ ] Original series (1-2) keeps its tasks
- [ ] Both series maintain their group structures

**Option C: "Modify all occurrences"**
- [ ] All occurrences (1-6) move
- [ ] All tasks remain linked to their respective occurrences
- [ ] Task due dates update by same time delta
- [ ] Original recurrence_master_id preserved

---

#### Test 2.1.4: Move Middle Group Event via Edit Dialog
**Setup:** Use same setup as Test 2.1.3

**Steps:**
1. Click on 3rd occurrence
2. Change date/time in edit dialog
3. Verify task links are visible
4. Test each save option

**Expected Outcomes:**
- [ ] Results match Test 2.1.3
- [ ] UI clearly shows linked tasks
- [ ] Option to modify task associations available

---

#### Test 2.1.5: Move Last Group Event via Drag & Drop
**Setup:** Daily recurring group event with 5 occurrences, each with 1 linked task, select 5th

**Steps:**
1. Drag 5th occurrence to new time/day
2. Test each dialog option

**Expected Outcomes:**
- [ ] Option A: 5th occurrence + its task move, create detached group
- [ ] Option B: Only 5th moves (no future), similar to Option A
- [ ] Option C: All 5 occurrences + all tasks move together
- [ ] Task associations preserved in all cases

---

#### Test 2.1.6: Move Last Group Event via Edit Dialog
**Setup:** Use same setup as Test 2.1.5

**Steps:**
1. Click on 5th occurrence
2. Change date/time
3. Test each save option

**Expected Outcomes:**
- [ ] Results match Test 2.1.5
- [ ] Linked task remains visible in edit dialog

---

### 2.2 Editing Group Events

#### Test 2.2.1: Edit First Group Event (Root) - Change Title
**Setup:** Weekly recurring group event with 4 occurrences, each with 2 linked tasks

**Steps:**
1. Click on first occurrence
2. Change event title
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Only first occurrence title changes
- [ ] Linked tasks remain associated
- [ ] Creates detached group event
- [ ] Original series continues

**Option B: "Modify this and future occurrences"**
- [ ] All occurrences have new title
- [ ] All task associations preserved
- [ ] Group structure maintained

**Option C: "Modify all occurrences"**
- [ ] All occurrences have new title
- [ ] All task associations preserved
- [ ] recurrence_master_id unchanged

---

#### Test 2.2.2: Edit First Group Event (Root) - Add/Remove Task
**Setup:** Use same setup, but focus on task modifications

**Steps:**
1. Click on first occurrence
2. Add a new linked task OR remove existing task
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Only first occurrence has modified task list
- [ ] Other occurrences maintain original tasks
- [ ] Detached group created with modified tasks

**Option B: "Modify this and future occurrences"**
- [ ] All occurrences have modified task list
- [ ] If adding task: new task added to all occurrences
- [ ] If removing task: task removed from all occurrences
- [ ] Task list synchronized

**Option C: "Modify all occurrences"**
- [ ] Same as Option B
- [ ] All occurrences updated

---

#### Test 2.2.3: Edit First Group Event (Root) - Change Task Details
**Setup:** Group event with recurring task associations

**Steps:**
1. Click on first occurrence
2. Open linked task and modify its properties (title, due date, description)
3. Observe behavior

**Expected Outcomes:**
- [ ] Task changes reflect only on that task instance
- [ ] Other occurrences' tasks remain unchanged (tasks are independent)
- [ ] Event-task link maintained
- [ ] No cascading changes to other occurrences

---

#### Test 2.2.4: Edit Middle Group Event - Change Title
**Setup:** Daily recurring group event with 10 occurrences, each with 1 linked task, select 5th

**Steps:**
1. Click on 5th occurrence
2. Change title
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Only 5th occurrence has new title
- [ ] Its linked task remains associated
- [ ] Creates detached group event
- [ ] Original series continues

**Option B: "Modify this and future occurrences"**
- [ ] Occurrences 5-10 have new title
- [ ] New series created
- [ ] Tasks 5-10 move with new series
- [ ] Series split correctly

**Option C: "Modify all occurrences"**
- [ ] All occurrences (1-10) have new title
- [ ] All tasks remain linked
- [ ] No series split

---

#### Test 2.2.5: Edit Middle Group Event - Add Task
**Setup:** Weekly recurring group event with 6 occurrences, 2 tasks each, select 3rd

**Steps:**
1. Click on 3rd occurrence
2. Add a third linked task
3. Test each save option:

**Option A: "Modify only this"**
- [ ] Only 3rd occurrence has 3 tasks
- [ ] Other occurrences still have 2 tasks
- [ ] Detached group created

**Option B: "Modify this and future occurrences"**
- [ ] Occurrences 3-6 have 3 tasks
- [ ] Occurrences 1-2 have 2 tasks
- [ ] New series created for 3-6
- [ ] Task counts differ between series

**Option C: "Modify all occurrences"**
- [ ] All occurrences (1-6) now have 3 tasks
- [ ] Third task added to all
- [ ] Original series structure maintained

---

#### Test 2.2.6: Edit Middle Group Event - Remove Task
**Setup:** Use same setup as Test 2.2.5, but remove a task instead

**Steps:**
1. Click on 3rd occurrence
2. Remove one of the 2 existing tasks
3. Test each save option

**Expected Outcomes:**
- [ ] Option A: Only 3rd has 1 task, others have 2
- [ ] Option B: Occurrences 3-6 have 1 task, 1-2 have 2
- [ ] Option C: All occurrences now have 1 task
- [ ] Removed tasks properly deleted or unlinked

---

#### Test 2.2.7: Edit Middle Group Event - Change Duration
**Setup:** Recurring group event with 8 occurrences, select 4th

**Steps:**
1. Click on 4th occurrence
2. Change duration from 1 hour to 3 hours
3. Test each save option

**Expected Outcomes:**
- [ ] Duration changes follow same pattern as title changes
- [ ] Linked tasks unaffected by duration change
- [ ] End time calculated correctly
- [ ] No scheduling conflicts

---

#### Test 2.2.8: Edit Last Group Event - Change Title and Add Task
**Setup:** Daily recurring group event with 5 occurrences, 1 task each, select 5th

**Steps:**
1. Click on 5th occurrence
2. Change title AND add a second task
3. Test each save option

**Expected Outcomes:**
- [ ] Option A: 5th has new title + 2 tasks, creates detached group
- [ ] Option B: Only 5th affected (no future), similar to Option A
- [ ] Option C: All 5 have new title + 2 tasks
- [ ] Multiple changes apply atomically

---

#### Test 2.2.9: Edit Last Group Event - Remove All Tasks
**Setup:** Use same setup, select 5th

**Steps:**
1. Click on 5th occurrence
2. Remove all linked tasks
3. Test each save option

**Expected Outcomes:**
- [ ] Event becomes non-group event
- [ ] Tasks are unlinked but not deleted (remain in task list)
- [ ] Event remains in series based on selected option
- [ ] No errors occur

---

### 2.3 Deleting Group Events

#### Test 2.3.1: Delete First Group Event (Root)
**Setup:** Weekly recurring group event with 6 occurrences, 2 tasks each

**Steps:**
1. Click on first occurrence
2. Click delete button
3. Test each delete option:

**Option A: "Delete only this"**
- [ ] First occurrence deleted
- [ ] Its 2 linked tasks: Dialog asks to delete tasks or keep them
  - If delete tasks: Tasks deleted
  - If keep tasks: Tasks become unlinked and remain in task list
- [ ] Remaining occurrences (2-6) continue with their tasks
- [ ] Gap at first position

**Option B: "Delete this and future occurrences"**
- [ ] All occurrences deleted (since this is root)
- [ ] Dialog asks about all linked tasks (12 total)
  - If delete tasks: All tasks deleted
  - If keep tasks: All tasks unlinked
- [ ] Entire series removed

**Option C: "Delete all occurrences"**
- [ ] All occurrences deleted
- [ ] Same task handling as Option B
- [ ] Entire series removed

---

#### Test 2.3.2: Delete First Group Event (Root) - Verify Task Behavior
**Setup:** Use same setup as Test 2.3.1

**Steps:**
1. Delete first occurrence with Option A
2. Choose to keep linked tasks
3. Verify task list

**Expected Outcomes:**
- [ ] Tasks remain in task list
- [ ] Tasks show as unlinked (no event association)
- [ ] Tasks can be re-linked to other events
- [ ] Remaining occurrences unaffected

**Repeat with:**
- [ ] Option A + delete tasks: Tasks removed from task list
- [ ] Remaining occurrences' tasks unaffected

---

#### Test 2.3.3: Delete Middle Group Event
**Setup:** Daily recurring group event with 10 occurrences, 3 tasks each, select 5th

**Steps:**
1. Click on 5th occurrence
2. Click delete button
3. Test each delete option:

**Option A: "Delete only this"**
- [ ] Only 5th occurrence deleted
- [ ] Dialog asks about 5th's 3 linked tasks
  - If delete tasks: 3 tasks deleted
  - If keep tasks: 3 tasks unlinked
- [ ] Occurrences 1-4 and 6-10 continue normally
- [ ] Gap at 5th position

**Option B: "Delete this and future occurrences"**
- [ ] Occurrences 5-10 deleted
- [ ] Dialog asks about 18 linked tasks (6 occurrences × 3 tasks)
  - If delete tasks: 18 tasks deleted
  - If keep tasks: 18 tasks unlinked
- [ ] Occurrences 1-4 remain with their tasks

**Option C: "Delete all occurrences"**
- [ ] All occurrences (1-10) deleted
- [ ] Dialog asks about all 30 tasks
- [ ] Task handling based on user choice
- [ ] Entire series removed

---

#### Test 2.3.4: Delete Middle Group Event - Mixed Task States
**Setup:** Recurring group event with 6 occurrences, but some tasks already completed

**Steps:**
1. Mark some tasks as completed in occurrences 3-4
2. Delete 3rd occurrence with Option A
3. Choose to keep tasks

**Expected Outcomes:**
- [ ] Completed tasks remain in task list (unlinked)
- [ ] Incomplete tasks remain in task list (unlinked)
- [ ] Task completion status preserved
- [ ] Tasks can still be managed independently

---

#### Test 2.3.5: Delete Last Group Event
**Setup:** Weekly recurring group event with 4 occurrences, 2 tasks each, select 4th

**Steps:**
1. Click on 4th occurrence
2. Click delete button
3. Test each delete option:

**Option A: "Delete only this"**
- [ ] Only 4th occurrence deleted
- [ ] Dialog asks about 4th's 2 tasks
- [ ] Task handling based on choice
- [ ] Occurrences 1-3 unaffected

**Option B: "Delete this and future occurrences"**
- [ ] Only 4th deleted (no future occurrences)
- [ ] Same result as Option A
- [ ] Dialog asks about 2 tasks

**Option C: "Delete all occurrences"**
- [ ] All occurrences (1-4) deleted
- [ ] Dialog asks about all 8 tasks
- [ ] Entire series removed based on task choice

---

#### Test 2.3.6: Delete Last Group Event - Keep Tasks
**Setup:** Use same setup as Test 2.3.5

**Steps:**
1. Delete 4th occurrence with Option A
2. Choose to keep tasks
3. Verify task list and task details

**Expected Outcomes:**
- [ ] 2 tasks remain in task list
- [ ] Tasks show no event association
- [ ] Tasks retain all other properties (title, due date, etc.)
- [ ] Tasks can be linked to new events

---

#### Test 2.3.7: Delete Multiple Middle Group Events Individually
**Setup:** Daily recurring group event with 7 occurrences, 1 task each

**Steps:**
1. Delete 2nd occurrence (Option A, keep task)
2. Delete 4th occurrence (Option A, delete task)
3. Delete 6th occurrence (Option A, keep task)

**Expected Outcomes:**
- [ ] Occurrences 1, 3, 5, 7 remain
- [ ] Tasks from 2nd and 6th occurrences unlinked but remain
- [ ] Task from 4th occurrence deleted
- [ ] Task list shows 3 unlinked tasks + 4 linked tasks
- [ ] Remaining occurrences function normally

---

#### Test 2.3.8: Delete Then Recreate Group Event
**Setup:** Weekly recurring group event with 5 occurrences, 2 tasks each

**Steps:**
1. Delete 3rd occurrence (Option A, delete tasks)
2. Manually create new event at same date/time
3. Add 2 new tasks to the new event

**Expected Outcomes:**
- [ ] New event is independent (no recurrence_master_id)
- [ ] New tasks are independent (not related to deleted tasks)
- [ ] Original series has gap at position 3
- [ ] New event coexists with original series
- [ ] No conflicts or data corruption

---

## Test Coverage Matrix

### Regular Recurring Events

| Position | Operation | Method | Modify Option | Test # | Status |
|----------|-----------|--------|---------------|--------|--------|
| First (Root) | Move | Drag & Drop | Only This | 1.1.1 | ⬜ |
| First (Root) | Move | Drag & Drop | This & Future | 1.1.1 | ⬜ |
| First (Root) | Move | Drag & Drop | All | 1.1.1 | ⬜ |
| First (Root) | Move | Edit Dialog | Only This | 1.1.2 | ⬜ |
| First (Root) | Move | Edit Dialog | This & Future | 1.1.2 | ⬜ |
| First (Root) | Move | Edit Dialog | All | 1.1.2 | ⬜ |
| Middle | Move | Drag & Drop | Only This | 1.1.3 | ⬜ |
| Middle | Move | Drag & Drop | This & Future | 1.1.3 | ⬜ |
| Middle | Move | Drag & Drop | All | 1.1.3 | ⬜ |
| Middle | Move | Edit Dialog | Only This | 1.1.4 | ⬜ |
| Middle | Move | Edit Dialog | This & Future | 1.1.4 | ⬜ |
| Middle | Move | Edit Dialog | All | 1.1.4 | ⬜ |
| Last | Move | Drag & Drop | Only This | 1.1.5 | ⬜ |
| Last | Move | Drag & Drop | This & Future | 1.1.5 | ⬜ |
| Last | Move | Drag & Drop | All | 1.1.5 | ⬜ |
| Last | Move | Edit Dialog | Only This | 1.1.6 | ⬜ |
| Last | Move | Edit Dialog | This & Future | 1.1.6 | ⬜ |
| Last | Move | Edit Dialog | All | 1.1.6 | ⬜ |
| First (Root) | Edit Title | Edit Dialog | Only This | 1.2.1 | ⬜ |
| First (Root) | Edit Title | Edit Dialog | This & Future | 1.2.1 | ⬜ |
| First (Root) | Edit Title | Edit Dialog | All | 1.2.1 | ⬜ |
| First (Root) | Edit Duration | Edit Dialog | Only This | 1.2.2 | ⬜ |
| First (Root) | Edit Duration | Edit Dialog | This & Future | 1.2.2 | ⬜ |
| First (Root) | Edit Duration | Edit Dialog | All | 1.2.2 | ⬜ |
| First (Root) | Edit Recurrence | Edit Dialog | Only This | 1.2.3 | ⬜ |
| First (Root) | Edit Recurrence | Edit Dialog | This & Future | 1.2.3 | ⬜ |
| First (Root) | Edit Recurrence | Edit Dialog | All | 1.2.3 | ⬜ |
| Middle | Edit Title | Edit Dialog | Only This | 1.2.4 | ⬜ |
| Middle | Edit Title | Edit Dialog | This & Future | 1.2.4 | ⬜ |
| Middle | Edit Title | Edit Dialog | All | 1.2.4 | ⬜ |
| Middle | Edit Multiple Fields | Edit Dialog | Only This | 1.2.5 | ⬜ |
| Middle | Edit Multiple Fields | Edit Dialog | This & Future | 1.2.5 | ⬜ |
| Middle | Edit Multiple Fields | Edit Dialog | All | 1.2.5 | ⬜ |
| Middle | Edit Linked Task | Edit Dialog | Only This | 1.2.6 | ⬜ |
| Middle | Edit Linked Task | Edit Dialog | This & Future | 1.2.6 | ⬜ |
| Middle | Edit Linked Task | Edit Dialog | All | 1.2.6 | ⬜ |
| Last | Edit Title | Edit Dialog | Only This | 1.2.7 | ⬜ |
| Last | Edit Title | Edit Dialog | This & Future | 1.2.7 | ⬜ |
| Last | Edit Title | Edit Dialog | All | 1.2.7 | ⬜ |
| Last | Edit Time & Date | Edit Dialog | Only This | 1.2.8 | ⬜ |
| Last | Edit Time & Date | Edit Dialog | This & Future | 1.2.8 | ⬜ |
| Last | Edit Time & Date | Edit Dialog | All | 1.2.8 | ⬜ |
| First (Root) | Delete | Delete Button | Only This | 1.3.1 | ⬜ |
| First (Root) | Delete | Delete Button | This & Future | 1.3.1 | ⬜ |
| First (Root) | Delete | Delete Button | All | 1.3.1 | ⬜ |
| Middle | Delete | Delete Button | Only This | 1.3.2 | ⬜ |
| Middle | Delete | Delete Button | This & Future | 1.3.2 | ⬜ |
| Middle | Delete | Delete Button | All | 1.3.2 | ⬜ |
| Last | Delete | Delete Button | Only This | 1.3.3 | ⬜ |
| Last | Delete | Delete Button | This & Future | 1.3.3 | ⬜ |
| Last | Delete | Delete Button | All | 1.3.3 | ⬜ |
| Multiple | Delete | Multiple Individual | Only This (×3) | 1.3.4 | ⬜ |
| Middle | Delete & Recreate | Manual Creation | N/A | 1.3.5 | ⬜ |

**Total Regular Event Test Cases: 57**

---

### Recurring Group Events

| Position | Operation | Method | Modify Option | Task Handling | Test # | Status |
|----------|-----------|--------|---------------|---------------|--------|--------|
| First (Root) | Move | Drag & Drop | Only This | N/A | 2.1.1 | ⬜ |
| First (Root) | Move | Drag & Drop | This & Future | N/A | 2.1.1 | ⬜ |
| First (Root) | Move | Drag & Drop | All | N/A | 2.1.1 | ⬜ |
| First (Root) | Move | Edit Dialog | Only This | N/A | 2.1.2 | ⬜ |
| First (Root) | Move | Edit Dialog | This & Future | N/A | 2.1.2 | ⬜ |
| First (Root) | Move | Edit Dialog | All | N/A | 2.1.2 | ⬜ |
| Middle | Move | Drag & Drop | Only This | N/A | 2.1.3 | ⬜ |
| Middle | Move | Drag & Drop | This & Future | N/A | 2.1.3 | ⬜ |
| Middle | Move | Drag & Drop | All | N/A | 2.1.3 | ⬜ |
| Middle | Move | Edit Dialog | Only This | N/A | 2.1.4 | ⬜ |
| Middle | Move | Edit Dialog | This & Future | N/A | 2.1.4 | ⬜ |
| Middle | Move | Edit Dialog | All | N/A | 2.1.4 | ⬜ |
| Last | Move | Drag & Drop | Only This | N/A | 2.1.5 | ⬜ |
| Last | Move | Drag & Drop | This & Future | N/A | 2.1.5 | ⬜ |
| Last | Move | Drag & Drop | All | N/A | 2.1.5 | ⬜ |
| Last | Move | Edit Dialog | Only This | N/A | 2.1.6 | ⬜ |
| Last | Move | Edit Dialog | This & Future | N/A | 2.1.6 | ⬜ |
| Last | Move | Edit Dialog | All | N/A | 2.1.6 | ⬜ |
| First (Root) | Edit Title | Edit Dialog | Only This | N/A | 2.2.1 | ⬜ |
| First (Root) | Edit Title | Edit Dialog | This & Future | N/A | 2.2.1 | ⬜ |
| First (Root) | Edit Title | Edit Dialog | All | N/A | 2.2.1 | ⬜ |
| First (Root) | Add/Remove Task | Edit Dialog | Only This | N/A | 2.2.2 | ⬜ |
| First (Root) | Add/Remove Task | Edit Dialog | This & Future | N/A | 2.2.2 | ⬜ |
| First (Root) | Add/Remove Task | Edit Dialog | All | N/A | 2.2.2 | ⬜ |
| First (Root) | Edit Task Details | Edit Dialog | N/A | N/A | 2.2.3 | ⬜ |
| Middle | Edit Title | Edit Dialog | Only This | N/A | 2.2.4 | ⬜ |
| Middle | Edit Title | Edit Dialog | This & Future | N/A | 2.2.4 | ⬜ |
| Middle | Edit Title | Edit Dialog | All | N/A | 2.2.4 | ⬜ |
| Middle | Add Task | Edit Dialog | Only This | N/A | 2.2.5 | ⬜ |
| Middle | Add Task | Edit Dialog | This & Future | N/A | 2.2.5 | ⬜ |
| Middle | Add Task | Edit Dialog | All | N/A | 2.2.5 | ⬜ |
| Middle | Remove Task | Edit Dialog | Only This | N/A | 2.2.6 | ⬜ |
| Middle | Remove Task | Edit Dialog | This & Future | N/A | 2.2.6 | ⬜ |
| Middle | Remove Task | Edit Dialog | All | N/A | 2.2.6 | ⬜ |
| Middle | Edit Duration | Edit Dialog | Only This | N/A | 2.2.7 | ⬜ |
| Middle | Edit Duration | Edit Dialog | This & Future | N/A | 2.2.7 | ⬜ |
| Middle | Edit Duration | Edit Dialog | All | N/A | 2.2.7 | ⬜ |
| Last | Edit Title & Add Task | Edit Dialog | Only This | N/A | 2.2.8 | ⬜ |
| Last | Edit Title & Add Task | Edit Dialog | This & Future | N/A | 2.2.8 | ⬜ |
| Last | Edit Title & Add Task | Edit Dialog | All | N/A | 2.2.8 | ⬜ |
| Last | Remove All Tasks | Edit Dialog | Only This | N/A | 2.2.9 | ⬜ |
| Last | Remove All Tasks | Edit Dialog | This & Future | N/A | 2.2.9 | ⬜ |
| Last | Remove All Tasks | Edit Dialog | All | N/A | 2.2.9 | ⬜ |
| First (Root) | Delete | Delete Button | Only This | Delete Tasks | 2.3.1 | ⬜ |
| First (Root) | Delete | Delete Button | Only This | Keep Tasks | 2.3.2 | ⬜ |
| First (Root) | Delete | Delete Button | This & Future | Delete Tasks | 2.3.1 | ⬜ |
| First (Root) | Delete | Delete Button | This & Future | Keep Tasks | 2.3.2 | ⬜ |
| First (Root) | Delete | Delete Button | All | Delete Tasks | 2.3.1 | ⬜ |
| First (Root) | Delete | Delete Button | All | Keep Tasks | 2.3.2 | ⬜ |
| Middle | Delete | Delete Button | Only This | Delete Tasks | 2.3.3 | ⬜ |
| Middle | Delete | Delete Button | Only This | Keep Tasks | 2.3.3 | ⬜ |
| Middle | Delete | Delete Button | This & Future | Delete Tasks | 2.3.3 | ⬜ |
| Middle | Delete | Delete Button | This & Future | Keep Tasks | 2.3.3 | ⬜ |
| Middle | Delete | Delete Button | All | Delete Tasks | 2.3.3 | ⬜ |
| Middle | Delete | Delete Button | All | Keep Tasks | 2.3.3 | ⬜ |
| Middle | Delete (Mixed Tasks) | Delete Button | Only This | Keep Tasks | 2.3.4 | ⬜ |
| Last | Delete | Delete Button | Only This | Delete Tasks | 2.3.5 | ⬜ |
| Last | Delete | Delete Button | Only This | Keep Tasks | 2.3.6 | ⬜ |
| Last | Delete | Delete Button | This & Future | Delete Tasks | 2.3.5 | ⬜ |
| Last | Delete | Delete Button | This & Future | Keep Tasks | 2.3.6 | ⬜ |
| Last | Delete | Delete Button | All | Delete Tasks | 2.3.5 | ⬜ |
| Last | Delete | Delete Button | All | Keep Tasks | 2.3.6 | ⬜ |
| Multiple | Delete | Multiple Individual | Mixed Options | Mixed | 2.3.7 | ⬜ |
| Middle | Delete & Recreate | Manual Creation | N/A | Delete Then Create | 2.3.8 | ⬜ |

**Total Group Event Test Cases: 63**

---

## Summary Statistics

- **Total Test Scenarios: 120**
- **Regular Recurring Events: 57 test cases**
- **Recurring Group Events: 63 test cases**

### Coverage Breakdown by Operation Type

| Operation | Regular Events | Group Events | Total |
|-----------|----------------|--------------|-------|
| Moving | 18 | 18 | 36 |
| Editing | 27 | 25 | 52 |
| Deleting | 12 | 20 | 32 |
| **Total** | **57** | **63** | **120** |

### Coverage Breakdown by Position

| Position | Regular Events | Group Events | Total |
|----------|----------------|--------------|-------|
| First (Root) | 21 | 24 | 45 |
| Middle | 27 | 28 | 55 |
| Last | 9 | 11 | 20 |
| **Total** | **57** | **63** | **120** |

### Coverage Breakdown by Modification Option

| Option | Regular Events | Group Events | Total |
|--------|----------------|--------------|-------|
| Only This | 19 | 21 | 40 |
| This & Future | 19 | 21 | 40 |
| All | 19 | 21 | 40 |
| **Total** | **57** | **63** | **120** |

---

## Testing Notes

### Critical Validation Points

1. **Data Integrity**
   - No orphaned events after any operation
   - recurrence_master_id relationships maintained correctly
   - Task-event links preserved or handled appropriately

2. **UI Consistency**
   - Recurrence indicators display correctly
   - Calendar refreshes properly after operations
   - No visual glitches or rendering issues

3. **Edge Cases**
   - Operations on single-occurrence recurring events
   - Concurrent edits by multiple users (if applicable)
   - Operations near recurrence end dates
   - Timezone handling for recurring events

4. **Performance**
   - Operations complete in reasonable time
   - No lag when displaying large recurring series
   - Efficient database queries for recurrence operations

### Common Issues to Watch For

- **Orphaned Events:** Events that lose their recurrence_master_id incorrectly
- **Duplicate Events:** Same event appearing multiple times after operations
- **Task Desyncing:** Linked tasks not updating with event changes
- **Series Splitting Errors:** Middle-event operations not creating proper new series
- **Delete Confirmation Bypass:** User not seeing task-handling dialogs
- **Calendar Refresh Failure:** Changes not reflected immediately in UI
- **Date Calculation Errors:** Recurring dates calculated incorrectly after modifications

---

## Post-Test Verification

After completing all tests, verify the following:

1. **Database State**
   - [ ] Run database query to check for orphaned events
   - [ ] Verify all recurrence_master_id references are valid
   - [ ] Check for any duplicate event entries
   - [ ] Confirm task-event relationships are consistent

2. **UI State**
   - [ ] Navigate through all calendar views (day, week, month)
   - [ ] Verify all recurring events display correctly
   - [ ] Check that recurrence indicators are accurate
   - [ ] Test calendar search functionality with recurring events

3. **Data Export/Import**
   - [ ] Export calendar with recurring events to ICS format
   - [ ] Import the ICS file and verify recurring events recreate correctly
   - [ ] Test calendar sync if applicable

4. **Performance Benchmarks**
   - [ ] Measure load time for calendar with 100+ recurring events
   - [ ] Test drag-and-drop responsiveness with recurring events
   - [ ] Verify no memory leaks after extended use

---

## Reporting Issues

When reporting bugs found during testing, include:

1. **Test Case Number** (e.g., Test 1.1.3)
2. **Actual Behavior** (what happened)
3. **Expected Behavior** (from this document)
4. **Steps to Reproduce** (exactly as performed)
5. **Screenshots/Videos** (if applicable)
6. **Browser/Device Information**
7. **Console Errors** (if any)
8. **Database State** (for data integrity issues)

---

**Document Version:** 1.0  
**Last Updated:** January 23, 2026  
**Maintained By:** Streamline Scheduler Team
