import { signToken, type UserSession } from "@/lib/auth";
import { cookieJar } from "./cookie-jar";

type Role = "Member" | "Manager" | "Admin";

/** Signs the request in as a member with `role`, using a real JWT. */
export function asUser(role: Role, overrides: Partial<UserSession> = {}): UserSession {
  const session: UserSession = {
    member_id: 1,
    email: `${role.toLowerCase()}@mdn.test`,
    name: `Test ${role}`,
    role,
    ...overrides,
  };
  cookieJar.token = signToken(session);
  return session;
}

export function asAnonymous() {
  cookieJar.token = undefined;
}
