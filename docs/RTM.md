# Requirements Traceability Matrix

## Significant Requirements

Five requirements cover the main features of the system:

- **FR-01 – Event management:** create events with a time span, location, managers and members; update and delete them (FR-02).
- **FR-03 – Role-based access:** Executives, Managers and Members each see and change different things, enforced on the server (FR-08).
- **FR-04 – Calendar view:** a month calendar of events and task deadlines.
- **FR-06 – Resource booking:** book resources for events or tasks from an inventory grouped by resource type (FR-05).
- **FR-07 – Clash flagging:** venue, resource and schedule overlaps are flagged automatically.

## Functional Requirements

| Req ID | Requirement | Categories | Source |
| :-- | :-- | :-- | :-- |
| FR-01 | The system shall allow Executives to create events with a name, description, start and end date/time, location, managers and members, and store them in the database. | Backend, Database | MDN |
| FR-02 | The system shall allow authorised users to update and delete events. Executives delete events; Managers edit the events they manage. | Backend, Database | MDN |
| FR-03 | The system shall give each member one of three roles (Executive, Manager, Member) that decides what they can see and change. Executives create accounts and assign roles. | Security, Backend, Database | MDN (admin) |
| FR-04 | The system shall provide a month calendar view of events and task deadlines. | UI | MDN |
| FR-05 | The system shall track an inventory of persistent resources, grouped by resource type, with a timeline of each resource's bookings. | UI, Backend, Database | MDN |
| FR-06 | The system shall allow users to create resources and locations (venues), book resources for an event or a task over a time window, and search allocations. | UI, Backend, Database | MDN |
| FR-07 | The system shall automatically flag clashing events: two events at one venue at the same time or one resource booked twice (errors), and two events at the same time (warning). | UI, Backend, Database | MDN |
| FR-08 | The system shall restrict access to features based on the role of the user's account, enforced on the server and not only by hiding controls. | Security | MDN |
| FR-09 | The system shall provide real-time validation and error feedback when users enter invalid or incomplete data, such as missing fields or invalid dates. | UI | [Stanford Usability Principles – Error Handling & Prevention](https://improvement.stanford.edu/resources/usability-principles) |
| FR-10 | The system shall give each task a budget and show each event's total budget as the sum of its tasks' budgets. Executives and Managers set budgets. | UI, Backend, Database | MDN |
| FR-11 | The system shall show users their overdue tasks (past deadline and not done) and blocked tasks, so problems are visible without checking each task. | UI, Backend | MDN |
| FR-12 | The system shall let users create tasks with a deadline, an optional event, assigned members and a status (Backlog, Ready to do, In progress, Blocked, Done). Members can update the status and details of tasks in their events. | UI, Backend, Database | MDN |
| FR-13 | The system shall show signed-in users an overview of upcoming events, tasks due this week, and overdue and blocked tasks. | UI | MDN |
| FR-14 | The system shall show visitors who are not signed in a public landing page with upcoming events, without exposing internal data (budgets, managers, tasks, resources). | UI | MDN |

## Non-Functional Requirements

| Req ID | Requirement | Categories | Source |
| :-- | :-- | :-- | :-- |
| NF-01 | The system shall authenticate users, store passwords securely and protect sessions, and shall require sign-in for all internal pages and data. | Security, Backend | MDN |
| NF-02 | The system shall keep an audit log of changes and sign-ins (who, when, what), including records removed by cascading deletes, viewable only by Executives. | Security, Backend, Database | MDN |
| NF-03 | The system shall provide an intuitive and consistent UI so that users of expected technical ability can use the software effectively without additional training. | UI | MDN |
| NF-04 | The system shall keep navigation and component placement consistent across all pages. | UI | [WCAG 2.1 – Consistent Navigation](https://www.w3.org/WAI/WCAG21/Understanding/consistent-navigation.html) |
| NF-05 | The system shall let users pick existing records (members, events, locations, resources, resource types) from lists and search boxes instead of typing names or IDs from memory. | UI | [Nielsen Norman Group – Recognition Rather Than Recall](https://www.nngroup.com/articles/recognition-and-recall/) |
