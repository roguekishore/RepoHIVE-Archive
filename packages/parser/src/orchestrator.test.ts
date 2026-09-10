/**
 * Tests for the Orchestrator (Task 9) — the error-gate behavior of
 * {@link parseProject}.
 *
 * Covers (design: "Orchestrator (Parser_System) and error aggregation (R10)"):
 * - Fatal input failure returns exactly one {@link ParseError} and never
 *   touches collection/extraction/serialization (R1.7).
 * - A recoverable per-file error recorded during extraction gates the write:
 *   the serializer is never invoked, zero bytes are written, and any
 *   pre-existing `graph.json` is left byte-for-byte unchanged (R10.3, R10.4,
 *   R10.6).
 * - All recorded errors are returned when more than one file fails.
 * - The happy path writes exactly once with the default output path
 *   `<projectDirectory>/graph.json` and returns the serializer's success.
 * - `tolerateFileErrors` opts out of the gate: the graph is written from the
 *   files that parsed and the skipped ones are reported on the success value —
 *   except when no file survived, which still fails.
 *
 * Uses `node:test` with injected {@link ParseDeps} stubs so the gate is
 * verified deterministically without the real filesystem or Tree-Sitter
 * runtime. A single real-filesystem test asserts the byte-for-byte
 * prior-file-untouched guarantee end-to-end through the real serializer.
 */

import assert from "node:assert/strict";
import * as nodeFs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, test } from "node:test";

import type { DependencyEdge, GraphNode } from "@repohive/shared";

import { parseProject, type ParseDeps } from "./orchestrator.js";
import {
  ParseErrorCollector,
  err,
  makeError,
  ok,
  type ParseError,
  type ParseSuccess,
} from "./errors.js";
import type { AstExtractor } from "./ast-extractor.js";
import type { CollectedFile, ExtractionResult } from "./types.js";
import type { InputValidator, ValidatedPath } from "./input-validator.js";
import type { SourceFileCollector } from "./source-collector.js";
import type { SymbolTableBuilder, SymbolTable } from "./symbol-table.js";
import type { Stitcher } from "./stitcher.js";
import type { GraphSerializer } from "./serializer.js";

// --- Stub builders --------------------------------------------------------

const ABS_ROOT = path.resolve("/projects/demo");

function validatorOk(absolutePath = ABS_ROOT): InputValidator {
  return {
    async validate() {
      return ok<ValidatedPath, ParseError>({ absolutePath });
    },
  };
}

function validatorFail(error: ParseError): InputValidator {
  return {
    async validate() {
      return err<ValidatedPath, ParseError>([error]);
    },
  };
}

function collectorOk(files: CollectedFile[]): SourceFileCollector {
  return {
    async collect() {
      return ok<CollectedFile[], ParseError>(files);
    },
  };
}

function collectorFail(error: ParseError): SourceFileCollector {
  return {
    async collect() {
      return err<CollectedFile[], ParseError>([error]);
    },
  };
}

/**
 * An extractor whose behavior is scripted per relative path: `null` triggers a
 * recorded per-file error (simulating unparseable/unreadable), otherwise the
 * mapped {@link ExtractionResult} is returned. Tracks which files it saw.
 */
function scriptedExtractor(
  script: Record<
    string,
    { result: ExtractionResult | null; error?: ParseError }
  >,
  seen: string[],
): AstExtractor {
  return {
    extract(file: CollectedFile, errors: ParseErrorCollector) {
      seen.push(file.relativePath);
      const entry = script[file.relativePath];
      if (entry === undefined || entry.result === null) {
        errors.add(
          entry?.error ??
            makeError(
              "file-unparseable",
              `Java source file could not be parsed: ${file.relativePath}`,
              file.relativePath,
            ),
        );
        return null;
      }
      return entry.result;
    },
  };
}

const passthroughSymbolTableBuilder: SymbolTableBuilder = {
  build(): SymbolTable {
    return {
      lookup: () => null,
      lookupInScope: () => null,
      lookupAcrossScopes: () => [],
    };
  },
};

const emptyStitcher: Stitcher = {
  stitch(): DependencyEdge[] {
    return [];
  },
};

/** A serializer stub that records every write and returns success. */
function recordingSerializer(writes: {
  calls: { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[];
}): GraphSerializer {
  return {
    async write(nodes, edges, outputPath) {
      writes.calls.push({ nodes, edges, outputPath });
      return ok<ParseSuccess, ParseError>({
        outputPath,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });
    },
  };
}

/** A serializer stub that fails the test if ever invoked. */
function forbiddenSerializer(): GraphSerializer {
  return {
    async write() {
      throw new Error("serializer.write must not be called when errors were recorded");
    },
  };
}

function file(relativePath: string): CollectedFile {
  return { absolutePath: path.join(ABS_ROOT, relativePath), relativePath };
}

function fileNode(relativePath: string): GraphNode {
  return { id: `file:${relativePath}`, kind: "file", directoryPath: "" };
}

function extraction(relativePath: string): ExtractionResult {
  return { nodes: [fileNode(relativePath)], references: [], packagePath: "" };
}

function baseDeps(overrides: Partial<ParseDeps>): ParseDeps {
  return {
    validator: validatorOk(),
    collector: collectorOk([file("A.java")]),
    createExtractor: async () => scriptedExtractor({}, []),
    symbolTableBuilder: passthroughSymbolTableBuilder,
    stitcher: emptyStitcher,
    serializer: forbiddenSerializer(),
    ...overrides,
  };
}

// --- Fatal input failure returns exactly one error (R1.7) -----------------

test("returns exactly one error for a fatal input failure and does no work", async () => {
  const inputError = makeError(
    "path-not-found",
    "Project directory path does not exist: /nope",
    "/nope",
  );
  let collectCalled = false;
  const deps = baseDeps({
    validator: validatorFail(inputError),
    collector: {
      async collect() {
        collectCalled = true;
        return ok<CollectedFile[], ParseError>([]);
      },
    },
  });

  const result = await parseProject({ projectDirectory: "/nope" }, deps);

  assert.ok(!result.ok);
  assert.equal(result.errors.length, 1, "exactly one error for fatal input");
  assert.equal(result.errors[0]!.reason, "path-not-found");
  assert.equal(collectCalled, false, "collection must not run after validation fails");
});

test("returns the single fatal collection error immediately", async () => {
  const collectError = makeError(
    "no-java-files",
    "No Java source files were found in the project directory: /projects/demo",
    ABS_ROOT,
  );
  const deps = baseDeps({ collector: collectorFail(collectError) });

  const result = await parseProject({ projectDirectory: ABS_ROOT }, deps);

  assert.ok(!result.ok);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.reason, "no-java-files");
});

// --- Recoverable per-file error gates the write (R10.3, R10.4) ------------

test("a recorded per-file error results in zero writes (serializer never called)", async () => {
  const seen: string[] = [];
  const deps = baseDeps({
    collector: collectorOk([file("A.java"), file("B.java")]),
    createExtractor: async () =>
      scriptedExtractor(
        {
          "A.java": { result: extraction("A.java") },
          // B.java fails to parse -> records an error, returns null.
          "B.java": { result: null },
        },
        seen,
      ),
    // Any invocation throws, proving the write is gated off.
    serializer: forbiddenSerializer(),
  });

  const result = await parseProject({ projectDirectory: ABS_ROOT }, deps);

  assert.ok(!result.ok, "run fails when a per-file error was recorded");
  assert.equal(result.errors[0]!.reason, "file-unparseable");
  assert.equal(result.errors[0]!.path, "B.java");
  // All files were still visited before the gate (parsing not aborted early).
  assert.deepEqual(seen, ["A.java", "B.java"]);
});

test("returns ALL recorded errors when multiple files fail", async () => {
  const seen: string[] = [];
  const deps = baseDeps({
    collector: collectorOk([file("A.java"), file("B.java"), file("C.java")]),
    createExtractor: async () =>
      scriptedExtractor(
        {
          "A.java": {
            result: null,
            error: makeError("file-unreadable", "unreadable A", "A.java"),
          },
          "B.java": { result: extraction("B.java") },
          "C.java": {
            result: null,
            error: makeError("file-unparseable", "unparseable C", "C.java"),
          },
        },
        seen,
      ),
    serializer: forbiddenSerializer(),
  });

  const result = await parseProject({ projectDirectory: ABS_ROOT }, deps);

  assert.ok(!result.ok);
  assert.equal(result.errors.length, 2, "both per-file errors are returned");
  assert.deepEqual(
    result.errors.map((e) => e.path).sort(),
    ["A.java", "C.java"],
  );
});

// --- Happy path: single write at the default output path ------------------

test("happy path writes exactly once at the default <projectDirectory>/graph.json", async () => {
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const deps = baseDeps({
    collector: collectorOk([file("A.java")]),
    createExtractor: async () =>
      scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
    serializer: recordingSerializer(writes),
  });

  const result = await parseProject({ projectDirectory: ABS_ROOT }, deps);

  assert.ok(result.ok, "happy path succeeds");
  assert.equal(writes.calls.length, 1, "serializer invoked exactly once");
  assert.equal(
    writes.calls[0]!.outputPath,
    path.join(ABS_ROOT, "graph.json"),
    "default output path is <projectDirectory>/graph.json",
  );
  assert.equal(result.value.outputPath, path.join(ABS_ROOT, "graph.json"));
});

test("honors an explicit outputPath when provided", async () => {
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const explicit = path.join(os.tmpdir(), "custom-graph.json");
  const deps = baseDeps({
    collector: collectorOk([file("A.java")]),
    createExtractor: async () =>
      scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
    serializer: recordingSerializer(writes),
  });

  const result = await parseProject(
    { projectDirectory: ABS_ROOT, outputPath: explicit },
    deps,
  );

  assert.ok(result.ok);
  assert.equal(writes.calls[0]!.outputPath, explicit);
});

// --- End-to-end: prior graph.json left byte-for-byte unchanged (R10.6) ----

test("leaves a pre-existing graph.json byte-for-byte unchanged when a per-file error occurs", async () => {
  const tmpRoot = await nodeFs.mkdtemp(
    path.join(os.tmpdir(), "repohive-orchestrator-"),
  );
  try {
    const outputPath = path.join(tmpRoot, "graph.json");
    // A prior valid graph.json on disk that must survive untouched.
    const priorContent = '{\n  "nodes": [],\n  "edges": []\n}\n';
    await nodeFs.writeFile(outputPath, priorContent, "utf8");

    // Use the REAL serializer so we prove the write is gated at the orchestrator
    // level (it is never invoked), not merely that a stub was skipped.
    const { createGraphSerializer } = await import("./serializer.js");
    const deps = baseDeps({
      validator: validatorOk(tmpRoot),
      collector: collectorOk([file("Broken.java")]),
      createExtractor: async () =>
        scriptedExtractor({ "Broken.java": { result: null } }, []),
      serializer: createGraphSerializer(),
    });

    const result = await parseProject({ projectDirectory: tmpRoot }, deps);

    assert.ok(!result.ok, "run fails due to the per-file error");
    const afterContent = await nodeFs.readFile(outputPath, "utf8");
    assert.equal(
      afterContent,
      priorContent,
      "prior graph.json must be byte-for-byte unchanged",
    );

    // And no temp file was left behind either.
    const entries = await nodeFs.readdir(tmpRoot);
    assert.deepEqual(
      entries.filter((e) => e.endsWith(".tmp")),
      [],
      "no temp file left behind",
    );
  } finally {
    await nodeFs.rm(tmpRoot, { recursive: true, force: true });
  }
});

// --- No exception escapes parseProject (Fix 2 — Gap 3) --------------------
//
// parseProject promised errors-as-values, but a throw from any collaborator
// escaped it. A legal Linux filename containing a backslash reached ids.ts's
// path guard, which throws, and extract wraps its call in try/finally with no
// catch — so one file crashed the whole run with a raw stack trace.

test("a throwing extractor becomes internal-error and writes nothing", async () => {
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const result = await parseProject(
    { projectDirectory: ABS_ROOT },
    baseDeps({
      collector: collectorOk([file("A.java")]),
      createExtractor: async () => ({
        extract(): never {
          throw new Error("tree-sitter exploded");
        },
      }),
      serializer: recordingSerializer(writes),
    }),
  );

  assert.ok(!result.ok, "a throwing collaborator must not reject the promise");
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]!.reason, "internal-error");
  assert.match(result.errors[0]!.message, /tree-sitter exploded/);
  assert.equal(writes.calls.length, 0, "nothing may be written");
});

test("a throwing validator, collector or serializer is also converted", async () => {
  const throwing = [
    {
      label: "validator",
      deps: baseDeps({
        validator: {
          async validate(): Promise<never> {
            throw new Error("validator exploded");
          },
        },
      }),
    },
    {
      label: "collector",
      deps: baseDeps({
        collector: {
          async collect(): Promise<never> {
            throw new Error("collector exploded");
          },
        },
      }),
    },
    {
      label: "serializer",
      deps: baseDeps({
        collector: collectorOk([file("A.java")]),
        createExtractor: async () => scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
        serializer: {
          async write(): Promise<never> {
            throw new Error("serializer exploded");
          },
        },
      }),
    },
  ];

  for (const { label, deps } of throwing) {
    const result = await parseProject({ projectDirectory: ABS_ROOT }, deps);
    assert.ok(!result.ok, `${label} must yield a Result`);
    assert.equal(result.errors[0]!.reason, "internal-error", label);
    assert.match(result.errors[0]!.message, new RegExp(`${label} exploded`), label);
  }
});

test("an unrepresentable path is recorded as recoverable and blocks the write", async () => {
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const result = await parseProject(
    { projectDirectory: ABS_ROOT },
    baseDeps({
      // The real collector reports through onUnsupportedPath; model that here.
      collector: {
        async collect(_root, options) {
          options?.onUnsupportedPath?.(
            makeError("path-unsupported", "path cannot be represented", "src/we\\ird.java"),
          );
          return ok<CollectedFile[], ParseError>([file("A.java")]);
        },
      },
      createExtractor: async () => scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
      serializer: recordingSerializer(writes),
    }),
  );

  assert.ok(!result.ok);
  assert.equal(result.errors[0]!.reason, "path-unsupported");
  assert.equal(result.errors[0]!.path, "src/we\\ird.java");
  // Parity with file-unreadable: recorded errors gate the write (R10.4).
  assert.equal(writes.calls.length, 0);
});

// --- tolerateFileErrors: opt out of the gate ------------------------------

test("tolerateFileErrors writes the surviving subset and reports the skipped files", async () => {
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const result = await parseProject(
    { projectDirectory: ABS_ROOT, tolerateFileErrors: true },
    baseDeps({
      collector: collectorOk([file("A.java"), file("B.java")]),
      // B.java is absent from the script, so the extractor records
      // `file-unparseable` for it and returns null.
      createExtractor: async () =>
        scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
      serializer: recordingSerializer(writes),
    }),
  );

  assert.ok(result.ok, "a partially-parseable project must still produce a graph");
  // The graph is exactly the subset that parsed: B.java contributed nothing.
  assert.equal(writes.calls.length, 1, "writes exactly once");
  assert.deepEqual(
    writes.calls[0]!.nodes.map((n) => n.id),
    ["file:A.java"],
  );
  assert.equal(result.value.nodeCount, 1);
  // The failure is reported rather than discarded — a silent skip would let a
  // repository quietly index as half itself.
  assert.equal(result.value.skippedFiles?.length, 1);
  assert.equal(result.value.skippedFiles?.[0]!.reason, "file-unparseable");
  assert.equal(result.value.skippedFiles?.[0]!.path, "B.java");
});

test("tolerateFileErrors still fails when no file survived", async () => {
  // An empty node set is the `no-java-files` condition reached by another
  // route. Writing an empty graph would only move the failure into `group`,
  // where it reads as a corrupt index rather than an unparseable repository.
  const result = await parseProject(
    { projectDirectory: ABS_ROOT, tolerateFileErrors: true },
    baseDeps({
      collector: collectorOk([file("A.java"), file("B.java")]),
      createExtractor: async () => scriptedExtractor({}, []),
      serializer: forbiddenSerializer(),
    }),
  );

  assert.ok(!result.ok, "a project in which nothing parsed must fail");
  assert.equal(result.errors.length, 2, "every recorded error is still returned");
});

test("tolerateFileErrors also tolerates a collector-recorded unrepresentable path", async () => {
  // `path-unsupported` is recorded during collection rather than extraction, so
  // it reaches the gate by a different route than the extractor's two reasons.
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const result = await parseProject(
    { projectDirectory: ABS_ROOT, tolerateFileErrors: true },
    baseDeps({
      collector: {
        async collect(_root, options) {
          options?.onUnsupportedPath?.(
            makeError("path-unsupported", "path cannot be represented", "src/we\\ird.java"),
          );
          return ok<CollectedFile[], ParseError>([file("A.java")]);
        },
      },
      createExtractor: async () =>
        scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
      serializer: recordingSerializer(writes),
    }),
  );

  assert.ok(result.ok);
  assert.equal(writes.calls.length, 1);
  assert.equal(result.value.skippedFiles?.length, 1);
  assert.equal(result.value.skippedFiles?.[0]!.reason, "path-unsupported");
});

test("the default mode is unchanged: no opt-in means the gate still holds", async () => {
  // Guards the R10.4 contract against the opt-in leaking into the default. Same
  // inputs as the tolerating test above, flag absent.
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const result = await parseProject(
    { projectDirectory: ABS_ROOT },
    baseDeps({
      collector: collectorOk([file("A.java"), file("B.java")]),
      createExtractor: async () =>
        scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
      serializer: recordingSerializer(writes),
    }),
  );

  assert.ok(!result.ok, "one unparseable file still fails the run by default");
  assert.equal(writes.calls.length, 0, "nothing is written");
});

test("a fully-parseable project reports no skippedFiles even when tolerating", async () => {
  // The field is absent, not an empty array, so a caller cannot mistake a clean
  // run for one that skipped nothing-in-particular.
  const writes = { calls: [] as { nodes: GraphNode[]; edges: DependencyEdge[]; outputPath: string }[] };
  const result = await parseProject(
    { projectDirectory: ABS_ROOT, tolerateFileErrors: true },
    baseDeps({
      collector: collectorOk([file("A.java")]),
      createExtractor: async () =>
        scriptedExtractor({ "A.java": { result: extraction("A.java") } }, []),
      serializer: recordingSerializer(writes),
    }),
  );

  assert.ok(result.ok);
  assert.equal(result.value.skippedFiles, undefined);
});
