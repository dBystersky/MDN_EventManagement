/**
 * Input validation — the rules (RTM Req 9).
 *
 * `lib/validation.ts` is pure, like `lib/conflicts.ts`, so these need no
 * database and no server. The same functions back both the inline form errors
 * and the API's 400s, so a rule tested here holds on both sides.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    firstError,
    hasErrors,
    isInPast,
    parseDate,
    validateAllocation,
    validateEvent,
    validateLogin,
    validateMember,
    validateNamed,
    validateResource,
    validateSubtaskDraft,
    validateTask,
} from "../lib/validation.ts";

const START = "2026-11-01T10:00";
const END = "2026-11-01T12:00";

const validEvent = { name: "Welcome night", date: START, endDate: END, locationId: "3" };

describe("validateEvent", () => {
    it("passes a complete event", () => {
        assert.deepEqual(validateEvent(validEvent), {});
    });

    it("names every missing field at once", () => {
        const errors = validateEvent({ name: "", date: "", endDate: "", locationId: "" });
        assert.deepEqual(Object.keys(errors).sort(), ["date", "endDate", "locationId", "name"]);
    });

    it("treats a whitespace-only name as missing", () => {
        assert.ok(validateEvent({ ...validEvent, name: "   " }).name);
    });

    it("puts an inverted range on the end, not the start", () => {
        const errors = validateEvent({ ...validEvent, date: END, endDate: START });
        assert.equal(errors.date, undefined);
        assert.match(errors.endDate ?? "", /end must be after the start/);
    });

    it("rejects an end equal to the start, matching the half-open rule", () => {
        assert.ok(validateEvent({ ...validEvent, endDate: START }).endDate);
    });

    it("rejects dates that will not parse", () => {
        const errors = validateEvent({ ...validEvent, date: "not a date" });
        assert.match(errors.date ?? "", /valid/);
        // No range complaint stacked on top of the parse error.
        assert.equal(errors.endDate, undefined);
    });

    it("accepts the ISO strings the API receives", () => {
        const errors = validateEvent({
            name: "x",
            date: "2026-11-01T10:00:00.000Z",
            endDate: "2026-11-01T12:00:00.000Z",
            locationId: 3,
        });
        assert.deepEqual(errors, {});
    });

    it("rejects a location id that is not a positive integer", () => {
        for (const locationId of ["0", "-1", "1.5", "abc", null]) {
            assert.ok(validateEvent({ ...validEvent, locationId }).locationId, String(locationId));
        }
    });

    it("in partial mode, checks only the fields that are present", () => {
        assert.deepEqual(validateEvent({ name: "Renamed" }, { partial: true }), {});
        assert.ok(validateEvent({ name: "" }, { partial: true }).name);
        assert.ok(
            validateEvent({ date: END, endDate: START }, { partial: true }).endDate,
            "a range sent in a PATCH is still checked",
        );
    });

    it("treats a non-object body as empty rather than throwing", () => {
        for (const body of [null, undefined, "x", 42, []]) {
            assert.ok(hasErrors(validateEvent(body)));
        }
    });
});

describe("validateTask", () => {
    const validTask = { name: "Book DJ", deadline: START, budget: "" };

    it("passes with no budget", () => {
        assert.deepEqual(validateTask(validTask), {});
    });

    it("accepts budgets the Decimal(10,2) column can hold", () => {
        for (const budget of ["0", "12", "12.5", "12.50", 99_999_999.99, null, undefined]) {
            assert.equal(validateTask({ ...validTask, budget }).budget, undefined, String(budget));
        }
    });

    it("rejects negative, non-numeric, over-precise and oversized budgets", () => {
        assert.match(validateTask({ ...validTask, budget: -5 }).budget ?? "", /negative/);
        assert.match(validateTask({ ...validTask, budget: "abc" }).budget ?? "", /number/);
        assert.match(validateTask({ ...validTask, budget: "1.234" }).budget ?? "", /2 decimal/);
        assert.match(validateTask({ ...validTask, budget: 1e9 }).budget ?? "", /less than/);
    });

    it("checks budget even in partial mode", () => {
        assert.ok(validateTask({ budget: -1 }, { partial: true }).budget);
    });

    it("requires a name and a deadline", () => {
        const errors = validateTask({ name: "", deadline: "" });
        assert.ok(errors.name);
        assert.ok(errors.deadline);
    });
});

describe("validateAllocation", () => {
    const valid = { resourceId: "1", bookableId: "2", startTime: START, endTime: END };

    it("passes a complete booking", () => {
        assert.deepEqual(validateAllocation(valid), {});
    });

    it("requires a resource and something to book against", () => {
        const errors = validateAllocation({ ...valid, resourceId: "", bookableId: "" });
        assert.ok(errors.resourceId);
        assert.ok(errors.bookableId);
    });

    it("puts an inverted window on endTime", () => {
        assert.ok(validateAllocation({ ...valid, startTime: END, endTime: START }).endTime);
    });
});

describe("the small forms", () => {
    it("validateNamed uses the noun it is given", () => {
        assert.equal(validateNamed({ name: "" }, "location").name, "Give the location a name.");
        assert.deepEqual(validateNamed({ name: "Hall A" }, "location"), {});
    });

    it("validateResource needs a name and a type", () => {
        const errors = validateResource({ name: "", resourceTypeId: "" });
        assert.ok(errors.name);
        assert.ok(errors.resourceTypeId);
    });

    it("validateSubtaskDraft needs a title and a due date", () => {
        assert.deepEqual(validateSubtaskDraft({ name: "Slides", deadline: "2026-11-01" }), {});
        assert.ok(validateSubtaskDraft({ name: "", deadline: "" }).name);
    });
});

describe("validateMember / validateLogin", () => {
    const valid = { name: "Jane Doe", email: "jane@example.com", password: "longenough" };

    it("passes a complete member", () => {
        assert.deepEqual(validateMember(valid), {});
    });

    it("rejects malformed emails", () => {
        for (const email of ["jane", "jane@", "@example.com", "jane@example", "a b@c.d"]) {
            assert.match(validateMember({ ...valid, email }).email ?? "", /valid email/, email);
        }
    });

    it("requires a password of at least 8 characters", () => {
        assert.ok(validateMember({ ...valid, password: "" }).password);
        assert.match(validateMember({ ...valid, password: "short" }).password ?? "", /8/);
    });

    it("login needs an email and any password", () => {
        assert.deepEqual(validateLogin({ email: "a@b.co", password: "x" }), {});
        assert.ok(validateLogin({ email: "", password: "" }).password);
    });
});

describe("helpers", () => {
    it("parseDate rejects five-digit years that datetime-local lets through", () => {
        assert.equal(parseDate("20266-11-01T10:00"), null);
        assert.ok(parseDate(START));
    });

    it("isInPast is a hint about the past, false for blanks", () => {
        const now = new Date(START).getTime();
        assert.equal(isInPast("2026-10-31T10:00", now), true);
        assert.equal(isInPast(END, now), false);
        assert.equal(isInPast("", now), false);
    });

    it("firstError gives the first message, hasErrors ignores empty entries", () => {
        assert.equal(firstError({ name: "A", date: "B" }), "A");
        assert.equal(hasErrors({}), false);
        assert.equal(hasErrors({ name: undefined }), false);
    });
});
