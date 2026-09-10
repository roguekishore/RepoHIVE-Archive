/**
 * Tests for the ingest endpoint's input validation.
 *
 * `POST /api/index` is public and unauthenticated, so `parseRepoUrl` is the SSRF
 * boundary and `isValidRepoId` is the path-traversal boundary. Both are pure, so
 * the cases that matter are cheap to pin — which is the point of keeping them in
 * a module with no filesystem or network reach.
 */

import { describe, expect, it } from "vitest";

import { isValidRepoId, parseRepoUrl, slugifyRepoId } from "./github-url";

describe("parseRepoUrl — accepted forms", () => {
  it("accepts a bare repository URL", () => {
    const result = parseRepoUrl("https://github.com/google/guava");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      owner: "google",
      repo: "guava",
      name: "google/guava",
      sourceUrl: "https://github.com/google/guava",
    });
  });

  it.each([
    ["a .git suffix", "https://github.com/google/guava.git"],
    ["a trailing slash", "https://github.com/google/guava/"],
    ["surrounding whitespace", "  https://github.com/google/guava  "],
    ["a deep link", "https://github.com/google/guava/tree/master/guava/src"],
    ["the www host", "https://www.github.com/google/guava"],
    ["a query string", "https://github.com/google/guava?tab=readme"],
    ["http, normalized to https", "http://github.com/google/guava"],
  ])("accepts %s", (_label, input) => {
    const result = parseRepoUrl(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Every accepted form reduces to the same normalized pair, which is what
    // makes the repoId stable across the ways people paste a URL.
    expect(result.value.sourceUrl).toBe("https://github.com/google/guava");
    expect(result.value.name).toBe("google/guava");
  });

  it("keeps dots and hyphens that are legal in a repository name", () => {
    const result = parseRepoUrl("https://github.com/apache/commons-lang.old");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.repo).toBe("commons-lang.old");
  });
});

describe("parseRepoUrl — SSRF rejections", () => {
  it.each([
    ["a non-GitHub host", "https://evil.example/google/guava"],
    ["a GitHub lookalike host", "https://github.com.evil.example/google/guava"],
    ["a subdomain of github.com", "https://raw.github.com/google/guava"],
    ["credentials smuggling the host", "https://github.com@evil.example/google/guava"],
    ["a userinfo component", "https://user:pass@github.com/google/guava"],
    ["an explicit port", "https://github.com:8080/google/guava"],
    ["the cloud metadata address", "http://169.254.169.254/latest/meta-data"],
    ["localhost", "http://localhost:3000/google/guava"],
    ["a loopback literal", "http://127.0.0.1/google/guava"],
    ["the file scheme", "file:///etc/passwd"],
    ["the gopher scheme", "gopher://github.com/google/guava"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a bare hostname with no scheme", "github.com/google/guava"],
    ["an internal host", "https://internal-api.svc.cluster.local/a/b"],
  ])("rejects %s", (_label, input) => {
    expect(parseRepoUrl(input).ok).toBe(false);
  });

  it.each([
    ["no repository segment", "https://github.com/google"],
    ["no path at all", "https://github.com/"],
    ["a dot repo name", "https://github.com/google/."],
    ["a dot-dot repo name", "https://github.com/google/.."],
    ["an owner with a slash-escape", "https://github.com/goo%2Fgle/guava"],
    ["an owner starting with a hyphen", "https://github.com/-google/guava"],
    ["an owner with illegal punctuation", "https://github.com/goo_gle!/guava"],
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("rejects %s", (_label, input) => {
    expect(parseRepoUrl(input).ok).toBe(false);
  });

  it.each([[null], [undefined], [42], [{}], [["https://github.com/a/b"]]])(
    "rejects the non-string input %s",
    (input) => {
      expect(parseRepoUrl(input).ok).toBe(false);
    },
  );

  it("rejects an over-long URL rather than working on it", () => {
    expect(parseRepoUrl(`https://github.com/google/${"a".repeat(4000)}`).ok).toBe(false);
  });

  it("normalizes traversal segments away instead of carrying them through", () => {
    // `new URL` resolves `..` before this function sees a path, so a pasted
    // traversal does not arrive as one. It is accepted as a plain owner/repo
    // pair, which at worst 404s against codeload — the point being that no `..`
    // ever reaches the filesystem, whether by rejection or by normalization.
    const result = parseRepoUrl("https://github.com/../../etc/passwd");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.owner).toBe("etc");
    expect(result.value.repo).toBe("passwd");
    expect(result.value.sourceUrl).toBe("https://github.com/etc/passwd");
    // And the id it would mint is still a single safe path segment.
    expect(isValidRepoId(slugifyRepoId(result.value.owner, result.value.repo))).toBe(true);
  });
});

describe("slugifyRepoId", () => {
  it("lowercases and joins owner and repo", () => {
    expect(slugifyRepoId("Google", "Guava")).toBe("google-guava");
  });

  it("collapses characters that are legal in a repo name but not in an id", () => {
    // `.` and `_` are legal on GitHub; the id is also a directory name and a URL
    // segment, so it is deliberately narrower.
    expect(slugifyRepoId("apache", "commons.lang_3")).toBe("apache-commons-lang-3");
  });

  it("produces ids that pass the id validator", () => {
    for (const [owner, repo] of [
      ["google", "guava"],
      ["Apache", "commons.lang_3"],
      ["a", "b--c"],
    ] as const) {
      expect(isValidRepoId(slugifyRepoId(owner, repo))).toBe(true);
    }
  });

  it("distinct repositories can collide on one slug", () => {
    // Which is what C1's collision suffix exists for.
    expect(slugifyRepoId("a", "b-c")).toBe(slugifyRepoId("a-b", "c"));
  });
});

describe("isValidRepoId", () => {
  it.each([["google-guava"], ["jsoup"], ["a"], ["google-guava-2"]])("accepts %s", (id) => {
    expect(isValidRepoId(id)).toBe(true);
  });

  it.each([
    [".."],
    ["."],
    ["../etc/passwd"],
    ["a/b"],
    ["a\\b"],
    ["/absolute"],
    ["C:\\windows"],
    ["Google-Guava"],
    ["-leading-hyphen"],
    ["with space"],
    ["with.dot"],
    ["with_underscore"],
    [""],
    ["a".repeat(129)],
  ])("rejects %s", (id) => {
    expect(isValidRepoId(id)).toBe(false);
  });
});
