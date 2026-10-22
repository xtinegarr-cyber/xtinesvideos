import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

// scrypt is built into Node, so passwords need no extra packages.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password, salt, n = N, r = R, p = P) {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/** Returns a string like "scrypt$16384$8$1$<salt>$<hash>" for the database. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64url");
  const actual = await derive(password, Buffer.from(saltB64, "base64url"), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Random token for the login cookie. */
export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

/** What gets stored in the database instead of the raw cookie token. */
export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function validateUsername(username) {
  if (!/^[a-z0-9_.]{3,32}$/.test(username)) {
    return "Usernames are 3–32 characters: lowercase letters, numbers, dots and underscores.";
  }
  return null;
}

export function validatePassword(password) {
  if (String(password).length < 8) return "Passwords need at least 8 characters.";
  if (String(password).length > 200) return "Passwords can be at most 200 characters.";
  return null;
}
