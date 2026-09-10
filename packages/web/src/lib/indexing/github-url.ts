/**
 * Source-URL validation for `POST /api/index` (SPEC item 5 — guard rails).
 *
 * The endpoint is public and unauthenticated, so the URL it is handed is
 * hostile input. Nothing here fetches: this module reduces a pasted string to
 * an `{ owner, repo }` pair or rejects it, and the caller builds the codeload
 * URL from a hardcoded host plus those two segments. That inversion — never
 * fetching the user's URL, only a URL we construct — is what closes SSRF
 * rather than merely narrowing it.
 *
 * Pure and dependency-free, so it is unit-testable without a filesystem or a
 * network.
 */

/** Hosts a submitted URL may name. Anything else is rejected outright. */
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(["github.com", "www.github.com"]);

/**
 * GitHub's own account-name rule: alphanumerics and single hyphens, 39 chars
 * max, no leading hyphen. Deliberately stricter than "not a traversal".
 */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/**
 * Repository names additionally allow `.` and `_`. The dot is why `.` and `..`
 * are excluded explicitly below — they match this pattern but are traversal
 * segments, and a repo cannot be named either.
 */
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export interface RepoRef {
  owner: string;
  repo: string;
  /** `owner/repo` — the C2 `name` field (repository.json carries no name). */
  name: string;
  /** Normalized `https://github.com/owner/repo` — the C2 `sourceUrl` field. */
  sourceUrl: string;
}

export type RepoRefResult =
  | { ok: true; value: RepoRef }
  | { ok: false; message: string };

function reject(message: string): RepoRefResult {
  return { ok: false, message };
}

/**
 * Validate a pasted GitHub URL and project it onto an `{ owner, repo }` pair.
 *
 * Accepts the forms people actually paste — a bare repo URL, a `.git` suffix, a
 * trailing slash, and a deep link such as `/tree/main/src` whose extra segments
 * are ignored because only the first two are ever used. Rejects a non-GitHub
 * host, embedded credentials (`https://x@github.com/...`), a non-default port,
 * and any owner or repo segment that is not a well-formed GitHub name.
 */
export function parseRepoUrl(input: unknown): RepoRefResult {
  if (typeof input !== "string" || input.trim() === "") {
    return reject("Provide a `url` string naming a public GitHub repository.");
  }
  const raw = input.trim();
  if (raw.length > 2048) {
    return reject("URL is too long.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return reject(`Not a valid URL: ${raw}`);
  }

  // http is tolerated on input and normalized to https on the way out; the
  // fetch itself is always https to a host we choose.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return reject(`Unsupported URL scheme '${url.protocol}'. Use https.`);
  }
  // `https://github.com@evil.example/...` parses with hostname evil.example,
  // but credentials are also a redirect-smuggling aid, so refuse them outright.
  if (url.username !== "" || url.password !== "") {
    return reject("URL must not contain credentials.");
  }
  if (url.port !== "") {
    return reject("URL must not specify a port.");
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return reject(
      `Only github.com URLs are accepted (got '${url.hostname}'). This demo indexes public GitHub repositories.`,
    );
  }

  const segments = url.pathname.split("/").filter((s) => s !== "");
  if (segments.length < 2) {
    return reject("URL must name a repository, as https://github.com/<owner>/<repo>.");
  }

  const owner = segments[0]!;
  const repo = segments[1]!.replace(/\.git$/, "");

  if (!OWNER_RE.test(owner)) {
    return reject(`'${owner}' is not a valid GitHub owner name.`);
  }
  if (repo === "." || repo === ".." || !REPO_RE.test(repo)) {
    return reject(`'${repo}' is not a valid GitHub repository name.`);
  }

  return {
    ok: true,
    value: {
      owner,
      repo,
      name: `${owner}/${repo}`,
      sourceUrl: `https://github.com/${owner}/${repo}`,
    },
  };
}

/**
 * The C1 `repoId`: a slugified `owner-repo`, lowercased, with every character
 * outside `[a-z0-9-]` collapsed to a single hyphen.
 *
 * This is a directory name and a URL path segment, so the output is
 * deliberately narrower than the input alphabet: `.` and `_` are legal in a
 * repo name but become hyphens here. The collision suffix that C1 calls for is
 * applied by the caller (`allocateRepoId`), which is the only place that can
 * see what is already on disk.
 */
export function slugifyRepoId(owner: string, repo: string): string {
  const slug = `${owner}-${repo}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Both segments passed the patterns above, so the only way to reach an empty
  // slug is a name made entirely of separators — not reachable today, but the
  // fallback keeps this function total.
  return slug === "" ? "repo" : slug;
}

/**
 * Whether a string is shaped like a repoId this service could have minted.
 *
 * Applied to the `[id]` route segment before it is joined onto the index root,
 * so a traversal or absolute path never reaches the filesystem.
 */
export function isValidRepoId(id: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,127})$/.test(id);
}
