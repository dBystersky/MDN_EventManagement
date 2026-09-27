# Requirements Traceability Matrix

## Functional Requirements

| Req. ID | Description | Categories | Source | Status |
| :---- | :---- | :---- | :---- | :---- |
| 1 | The system shall allow users to create new events with all the relevant information, such as venue, date, etc. and store it in the database. | Backend, Database | MDN | Agreed |
| 2 | The system shall allow authorised users to update events with updated information and delete existing events | Backend, Database | MDN | Agreed |
| 3 | Being able to assign members different levels of security, depending on their role (admin,member,committee) | Security Backend Database | MDN specially admin | Agreed |
| 4 | The system shall provide a calendar view of events/tasks.  | UI, Visualisation | MDN | Agreed |
| 5 | Inventory tracking, of persistent items/resources, that can be allocated | UI, Frontend, Backend | MDN | Agreed |
| 6 | The system shall allow authorised users to book and create resources (e.g. venues, equipment) for events, storing resource details and availability in the database.  | UI, Backend, Database | MDN | Agreed |
| 7 | The system shall automatically flag when events are overlapping/clashing with dates, venues, or assigned resources. | Backend | MDN | Agreed |
| 8 | The system shall restrict access to specific features based on the role of the user’s account. | Security | MDN | Agreed |
| 9 | The system shall provide real‑time validation and error feedback when users input invalid or incomplete data (e.g., missing fields, invalid dates). | UI | [https://improvement.stanford.edu/resources/usability-principles](https://improvement.stanford.edu/resources/usability-principles): Error Handling & Prevention | Agreed |
| 10 | Events will have a section to track spending/Budget | UI, Frontend, Backend  | MDN | Agreed |
| 11 | The system shall notify relevant users of key events, such as task assignments, approaching due dates, event conflicts, and audit-relevant changes.  | UI, Backend | MDN | Advanced |

## Non-Functional Requirements

| Req. ID | Description | Categories | Type (s) (FR/NFR) | Source | Status |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 12 | The system shall authenticate users and protect sessions/tokens appropriately for a web app. | Security, backend | NFR | MDN | Advance |
| 13 | The system shall maintain an audit log of security-relevant changes (who/when/what) with tamper-resistant storage rules. | Security, database, backend | NFR | MDN | Agreed |
| 14 | The system shall provide an intuitive and consistent UI such that users of expected technical abilities can effectively use the software without additional training. | UI | NFR | MDN | Agreed |
| 15 | The system shall maintain consistent navigation structures and component placement across all pages.   | UI | NFR | [https://www.w3.org/WAI/WCAG21/Understanding/consistent-navigation.html](https://www.w3.org/WAI/WCAG21/Understanding/consistent-navigation.html)  | Agreed |
| 16 | The system shall avoid animations that flash more than three times per second and provide a setting to reduce motion.   | UI | NFR | [https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html)  | Agreed |

