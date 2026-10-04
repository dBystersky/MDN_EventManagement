"use client";

import { useState } from "react";

import { hasErrors, type FieldErrors } from "@/lib/validation";

/**
 * Real-time field errors for a form (RTM Req 9).
 *
 * The rules come from `lib/validation.ts`, the same ones the API enforces. This
 * hook only decides *when* a field's error is shown:
 *
 * - **Not before the user has had a go.** A field stays quiet until it has been
 *   left (`onBlur`) or, for pickers, changed (`touch`). Shouting "required" at
 *   an empty form is noise.
 * - **Live after that.** Errors are derived from the current values on every
 *   render, so once shown, a message updates per keystroke and disappears the
 *   moment the value is fixed.
 * - **Everything on submit.** `checkBeforeSubmit` reveals all errors at once and
 *   moves focus to the first one, so the user is told what is missing instead
 *   of the button doing nothing.
 *
 * Errors the server reports (`ApiError.fieldErrors`) sit on the field they name
 * until that field is edited — the server's verdict was about the old value.
 */
export function useFieldValidation<K extends string>(
  values: Record<K, unknown>,
  validate: (values: Record<K, unknown>) => FieldErrors<K>,
) {
  const errors = validate(values);
  const [touched, setTouched] = useState<ReadonlySet<K>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState<{
    errors: FieldErrors<K>;
    values: Record<K, unknown>;
  } | null>(null);

  function errorFor(field: K): string | undefined {
    if ((submitted || touched.has(field)) && errors[field]) return errors[field];
    if (server?.errors[field] && Object.is(server.values[field], values[field])) {
      return server.errors[field];
    }
    return undefined;
  }

  function touch(field: K) {
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  }

  /**
   * Props for the control itself. `id` is the control's own id; the message is
   * rendered as `${id}-error` so screen readers read it with the field.
   *
   * `touchOnBlur: false` is for optional groups — the event form's subtask
   * composer — where tabbing past an empty field is not a mistake.
   */
  function fieldProps(field: K, id: string, { touchOnBlur = true } = {}) {
    const invalid = Boolean(errorFor(field));
    return {
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${id}-error` : undefined,
      onBlur: touchOnBlur ? () => touch(field) : undefined,
    };
  }

  /**
   * Reveals every error; true when the form may be sent. `scope` is where to
   * look for the first invalid control to focus — the form, usually.
   */
  function checkBeforeSubmit(scope?: HTMLElement | null): boolean {
    setSubmitted(true);
    if (!hasErrors(errors)) return true;
    // After React commits the aria-invalid it just learned about.
    requestAnimationFrame(() => {
      (scope ?? document)
        .querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    });
    return false;
  }

  /**
   * Shows the server's field errors. False when none of them belong to this
   * form, so the caller can fall back to its banner.
   */
  function setServerErrors(fieldErrors: Record<string, string>): boolean {
    const known = Object.keys(fieldErrors).filter((key) => key in values) as K[];
    if (known.length === 0) return false;
    const picked: FieldErrors<K> = {};
    for (const key of known) picked[key] = fieldErrors[key];
    setServer({ errors: picked, values: { ...values } });
    return true;
  }

  /** Back to pristine: call whenever the form is cleared or loaded with a new row. */
  function reset() {
    setTouched(new Set());
    setSubmitted(false);
    setServer(null);
  }

  return { errorFor, fieldProps, touch, checkBeforeSubmit, setServerErrors, reset };
}

export type FieldValidation<K extends string> = ReturnType<typeof useFieldValidation<K>>;
