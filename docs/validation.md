# Input validation

Requirement 9: *the system shall provide real-time validation and error feedback
when users input invalid or incomplete data (e.g., missing fields, invalid dates).*

## One set of rules, two places

`lib/validation.ts` holds every rule. It is pure, with no React and no Prisma,
the same way `lib/conflicts.ts` is. Two places run it:

| Where | How | Result |
|-------|-----|--------|
| Forms | `hooks/use-field-validation.ts` | A message under the field, while typing |
| API write routes | `validationFailed()` in `lib/api-errors.ts` | `400 { error, fieldErrors }` |

Errors are keyed by the **API field names** (`endDate`, `locationId`,
`resourceTypeId`, …). A 400 from the server therefore lands under the matching
field in the form with no mapping code. `apiJson` throws an `ApiError` that
carries `fieldErrors`, and `validation.setServerErrors(err.fieldErrors)` shows
them.

The response keeps `error` as a one-line summary, so older callers that only read
`error` still work.

## When an error shows

The rules run on every render. The hook only decides *when* to show what they
found:

- **Not before the user has had a go.** A field stays quiet until the user leaves
  it, or for pickers and date inputs, until its value changes.
- **Live after that.** A shown error updates on each keystroke, and it disappears
  as soon as the value is fixed.
- **Everything on submit.** Every error shows at once and focus moves to the
  first one. Submit buttons are never disabled just for invalid input, because a
  dead button does not say what is missing.
- **Server errors stick to the value they were about.** Edit that field and the
  error goes.

Forms use `noValidate` so the browser's own bubbles don't compete with the inline
messages. `required` stays on the inputs for assistive technology.

## Rules worth knowing

| Rule | Why |
|------|-----|
| An end equal to the start is an error | Intervals are half-open (see [conflict-detection.md](./conflict-detection.md)). A zero-length range silently skips clash detection |
| A range error goes on the *end* field | The end is the field the user is usually fixing |
| A date in the past is a hint, not an error | Flag, don't block. Back-filling a past event is legitimate |
| Budgets: ≥ 0, at most 2 decimals, < 100,000,000 | What `Decimal(10, 2)` can hold, so nothing is silently rounded |
| A new member's password must be at least 8 characters | Set on create only |
| PATCH bodies are checked with `{ partial: true }` | A missing field means "leave it alone", not "blank it". A field sent empty is still an error |

## Adding a field or a form

1. Add the rule to the matching `validate*` function in `lib/validation.ts`, keyed
   by the API field name, and add a case to `tests/validation.test.ts`.
2. For a new form, call
   `useFieldValidation({ ...values }, validateThing)`. On each control:
   - spread `validation.fieldProps("field", "control-id")`
   - render `<FieldError id="control-id-error">` (from `@/components/ui/field`)
3. In the submit handler:
   - start with `if (!validation.checkBeforeSubmit(e.currentTarget)) return;`
   - in the catch, call `setServerErrors`
   - call `validation.reset()` wherever the form is cleared
4. For a new route, put `validationFailed(validateThing(body))` before the `lib/` call.

Tests: `tests/validation.test.ts` covers the rules. `tests/validation-api.test.ts`
covers the routes.
