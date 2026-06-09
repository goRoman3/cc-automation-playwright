import dotenv from 'dotenv';

dotenv.config();

export interface TestUser {
  alias: string;
  email: string;
  password: string;
  newPassword: string | null;
}

interface RawTestUser {
  alias?: string;
  email?: string;
  password?: string;
  newPassword?: string;
}

/**
 * Returns a test user by alias.
 *
 * Resolution order:
 * 1. TEST_USERS_JSON — JSON array of { alias, email, password, newPassword }
 * 2. TEST_EMAIL / TEST_PASSWORD / TEST_NEW_PASSWORD — single-user fallback
 */
export function getTestUser(alias = 'default'): TestUser {
  if (process.env.TEST_USERS_JSON) {
    let users: RawTestUser[];

    try {
      users = JSON.parse(process.env.TEST_USERS_JSON) as RawTestUser[];
    } catch (err) {
      throw new Error(`TEST_USERS_JSON is not valid JSON: ${(err as Error).message}`);
    }

    if (!Array.isArray(users)) {
      throw new Error('TEST_USERS_JSON must be a JSON array of user objects.');
    }

    const user = users.find(u => u.alias === alias);

    if (!user) {
      const available = users.map(u => u.alias).join(', ');
      throw new Error(
        `No test user with alias "${alias}" in TEST_USERS_JSON.\n` +
          `Available aliases: ${available}`,
      );
    }

    if (!user.email || !user.password) {
      const missing = [!user.email && 'email', !user.password && 'password']
        .filter(Boolean)
        .join(' ');
      throw new Error(
        `Test user "${alias}" in TEST_USERS_JSON is missing required field(s): ${missing}`,
      );
    }

    return {
      alias: user.alias ?? alias,
      email: user.email,
      password: user.password,
      newPassword: user.newPassword ?? null,
    };
  }

  // ── Single-user fallback ────────────────────────────────────────────────────
  const { TEST_EMAIL, TEST_PASSWORD, TEST_NEW_PASSWORD } = process.env;

  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'No test credentials found. Provide either:\n' +
        '  • TEST_EMAIL + TEST_PASSWORD (+ optionally TEST_NEW_PASSWORD)\n' +
        '  • TEST_USERS_JSON in your .env file.',
    );
  }

  return {
    alias: 'default',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    newPassword: TEST_NEW_PASSWORD ?? null,
  };
}
