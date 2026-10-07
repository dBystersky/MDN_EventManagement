/**
 * Input validation — the rules (RTM Req 9).
 *
 * Pure on purpose, like `lib/conflicts.ts`: no React, no Prisma. The same
 * functions run in the browser, where `hooks/use-field-validation.ts` turns them
 * into inline errors as the user types, and in the route handlers, where
 * `validationFailed` in `lib/api-errors.ts` turns them into a 400. One set of
 * rules means the form and the API can never disagree about what is valid.
 *
 * Errors are keyed by the API's own field names (`endDate`, `locationId`, …), so
 * an error the server reports lands on the matching field in the form.
 *
 * Inputs are loose — form state is all strings, a JSON body is anything — so
 * every rule coerces rather than trusting the type.
 */

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

type Input<K extends string> = Partial<Record<K, unknown>>;

export type ValidateOptions = {
  /**
   * For PATCH: a field that is absent is being left alone, so it is not
   * "missing". Fields that are present are still checked in full.
   */
  partial?: boolean;
};

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** The first message, for a one-line summary. */
export function firstError(errors: FieldErrors): string | undefined {
  return Object.values(errors).find((message): message is string => Boolean(message));
}

/** Drops `undefined` entries so `{}` really means "valid". */
function compact<K extends string>(errors: Record<K, string | undefined>): FieldErrors<K> {
  const result: FieldErrors<K> = {};
  for (const key of Object.keys(errors) as K[]) {
    if (errors[key]) result[key] = errors[key];
  }
  return result;
}

/** A JSON body may be null, an array, or a string; treat all of those as empty. */
function asInput<K extends string>(value: unknown): Input<K> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Input<K>) : {};
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function isBlank(value: unknown): boolean {
  return text(value) === "";
}

/**
 * A timestamp, or null when it will not parse.
 *
 * The year bound catches what `datetime-local` happily accepts — a five-digit
 * year from one keystroke too many — which `Date` parses without complaint.
 */
export function parseDate(value: unknown): Date | null {
  if (isBlank(value)) return null;
  const parsed = new Date(text(value));
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  return year >= 1000 && year <= 9999 ? parsed : null;
}

/** True for a parseable timestamp before `now`. A hint for the forms, never an error. */
export function isInPast(value: unknown, now = Date.now()): boolean {
  const parsed = parseDate(value);
  return parsed != null && parsed.getTime() < now;
}

type Rule = (value: unknown) => string | undefined;

/** Runs `rule` unless this is a partial update that leaves the field alone. */
function check(input: Input<string>, key: string, rule: Rule, options: ValidateOptions) {
  if (options.partial && input[key] === undefined) return undefined;
  return rule(input[key]);
}

const requiredText =
  (message: string): Rule =>
  (value) =>
    isBlank(value) ? message : undefined;

const requiredDate =
  (missing: string, invalid: string): Rule =>
  (value) => {
    if (isBlank(value)) return missing;
    return parseDate(value) ? undefined : invalid;
  };

const requiredId =
  (message: string): Rule =>
  (value) => {
    const id = Number(value);
    return isBlank(value) || !Number.isInteger(id) || id <= 0 ? message : undefined;
  };

/**
 * End strictly after start — the half-open rule `assertForwardWindow` in
 * `lib/resourceAllocations.ts` enforces on write, so equal is an error too.
 * Silent until both ends parse; the missing/invalid messages cover the rest.
 */
function forwardRange(start: unknown, end: unknown): string | undefined {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) return undefined;
  return to.getTime() > from.getTime() ? undefined : "The end must be after the start.";
}

/** What `Decimal(10, 2)` can hold. */
const MAX_MONEY = 100_000_000;

/** Optional money: blank is fine, anything else must fit the column exactly. */
function money(label: string): Rule {
  return (value) => {
    if (isBlank(value)) return undefined;
    const amount = Number(text(value));
    if (!Number.isFinite(amount)) return `${label} must be a number.`;
    if (amount < 0) return `${label} cannot be negative.`;
    if (amount >= MAX_MONEY) return `${label} must be less than 100,000,000.`;
    // On the string form, so 1.234 is caught rather than silently rounded.
    if (!/^\d+(\.\d{1,2})?$/.test(String(amount))) {
      return `${label} can have at most 2 decimal places.`;
    }
    return undefined;
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email =
  (missing: string): Rule =>
  (value) => {
    if (isBlank(value)) return missing;
    return EMAIL.test(text(value))
      ? undefined
      : "Enter a valid email address, like jane@example.com.";
  };

export const MIN_PASSWORD_LENGTH = 8;

export type EventField = "name" | "date" | "endDate" | "locationId";

export function validateEvent(
  value: unknown,
  options: ValidateOptions = {},
): FieldErrors<EventField> {
  const input = asInput<EventField>(value);
  return compact({
    name: check(input, "name", requiredText("Give the event a name."), options),
    date: check(
      input,
      "date",
      requiredDate("Pick a start time.", "Enter a valid start time."),
      options,
    ),
    endDate:
      check(
        input,
        "endDate",
        requiredDate("Pick an end time.", "Enter a valid end time."),
        options,
      ) ?? forwardRange(input.date, input.endDate),
    locationId: check(input, "locationId", requiredId("Pick a location."), options),
  });
}

export type TaskField = "name" | "deadline" | "budget";

export function validateTask(
  value: unknown,
  options: ValidateOptions = {},
): FieldErrors<TaskField> {
  const input = asInput<TaskField>(value);
  return compact({
    name: check(input, "name", requiredText("Give the task a name."), options),
    deadline: check(
      input,
      "deadline",
      requiredDate("Pick a deadline.", "Enter a valid deadline."),
      options,
    ),
    budget: money("Budget")(input.budget),
  });
}

export type SubtaskDraftField = "name" | "deadline";

/** The subtask composer on the event form, before the draft joins the list. */
export function validateSubtaskDraft(value: unknown): FieldErrors<SubtaskDraftField> {
  const input = asInput<SubtaskDraftField>(value);
  return compact({
    name: requiredText("Give the subtask a title.")(input.name),
    deadline: requiredDate("Pick a due date.", "Enter a valid due date.")(input.deadline),
  });
}

export type AllocationField = "resourceId" | "bookableId" | "startTime" | "endTime";

export function validateAllocation(
  value: unknown,
  options: ValidateOptions = {},
): FieldErrors<AllocationField> {
  const input = asInput<AllocationField>(value);
  return compact({
    resourceId: check(input, "resourceId", requiredId("Pick a resource."), options),
    bookableId: check(
      input,
      "bookableId",
      requiredId("Pick an event or task to book against."),
      options,
    ),
    startTime: check(
      input,
      "startTime",
      requiredDate("Pick a start time.", "Enter a valid start time."),
      options,
    ),
    endTime:
      check(
        input,
        "endTime",
        requiredDate("Pick an end time.", "Enter a valid end time."),
        options,
      ) ?? forwardRange(input.startTime, input.endTime),
  });
}

/** Anything whose only field is a name: locations, resource types. */
export function validateNamed(
  value: unknown,
  noun: string,
  options: ValidateOptions = {},
): FieldErrors<"name"> {
  const input = asInput<"name">(value);
  return compact({
    name: check(input, "name", requiredText(`Give the ${noun} a name.`), options),
  });
}

export type ResourceField = "name" | "resourceTypeId";

export function validateResource(
  value: unknown,
  options: ValidateOptions = {},
): FieldErrors<ResourceField> {
  const input = asInput<ResourceField>(value);
  return compact({
    name: check(input, "name", requiredText("Give the resource a name."), options),
    resourceTypeId: check(input, "resourceTypeId", requiredId("Pick a resource type."), options),
  });
}

export type MemberField = "name" | "email" | "password";

export function validateMember(value: unknown): FieldErrors<MemberField> {
  const input = asInput<MemberField>(value);
  // Not trimmed: a password is exactly what was typed.
  const password = input.password == null ? "" : String(input.password);
  return compact({
    name: requiredText("Enter the member's full name.")(input.name),
    email: email("Enter an email address.")(input.email),
    password:
      password === ""
        ? "Set a temporary password."
        : password.length < MIN_PASSWORD_LENGTH
          ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
          : undefined,
  });
}

export type LoginField = "email" | "password";

export function validateLogin(value: unknown): FieldErrors<LoginField> {
  const input = asInput<LoginField>(value);
  return compact({
    email: email("Enter your email address.")(input.email),
    password: input.password ? undefined : "Enter your password.",
  });
}
