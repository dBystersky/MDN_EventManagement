/**
 * Who may manage resources and resource types.
 *
 * Roles exist in the schema (`MemberRole`) and ride along in the auth token
 * (`lib/auth.ts`), but nothing in the app enforces them yet. This module is the
 * single place that decides — so when the rules land, they land here instead of
 * being scattered through page JSX.
 *
 * IMPORTANT: this is presentation only. A disabled button stops nobody from
 * calling `POST /api/resources` directly. Real enforcement means the route
 * handlers checking `getAuthSession()` server-side; this module just lets the
 * client and server agree on the same rules.
 */

export type Role = "Member" | "Manager" | "Admin";

export type Capabilities = {
  create: boolean;
  edit: boolean;
  delete: boolean;
};

/**
 * Flip to `true` to start enforcing the role lists below. While it is `false`
 * everyone — signed in or not — keeps the access they have today.
 */
const ENFORCED = false;

const RESOURCE_MANAGERS: readonly Role[] = ["Member", "Manager", "Admin"];
const RESOURCE_TYPE_MANAGERS: readonly Role[] = ["Member", "Manager", "Admin"];
const ALLOCATION_MANAGERS: readonly Role[] = ["Member", "Manager", "Admin"];

const FULL_ACCESS: Capabilities = { create: true, edit: true, delete: true };

function capabilitiesFor(
  role: string | null | undefined,
  allowed: readonly Role[],
): Capabilities {
  if (!ENFORCED) return FULL_ACCESS;

  const permitted = role != null && allowed.includes(role as Role);
  return { create: permitted, edit: permitted, delete: permitted };
}

export function resourcePermissions(role: string | null | undefined): Capabilities {
  return capabilitiesFor(role, RESOURCE_MANAGERS);
}

export function resourceTypePermissions(role: string | null | undefined): Capabilities {
  return capabilitiesFor(role, RESOURCE_TYPE_MANAGERS);
}

export function allocationPermissions(role: string | null | undefined): Capabilities {
  return capabilitiesFor(role, ALLOCATION_MANAGERS);
}

/**
 * Reads the current member's role from the session endpoint. Returns `null` for
 * anonymous visitors — `/api/auth/me` answers 401 when there is no cookie, and
 * `apiJson` would throw on that, so this deliberately uses a plain `fetch`.
 */
export async function fetchSessionRole(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const json = await res.json();
    return json?.user?.role ?? null;
  } catch {
    return null;
  }
}
