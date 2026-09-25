// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
const script = path.resolve("scripts/quality-metrics.mjs");
const source = `export function outer(flag: boolean) {
  if (flag) return inner();
  return 0;
  function inner() {
    return 7;
  }
}
export function unmapped() { return 9; }
`;
const loc = (startLine: number, startColumn: number, endLine: number, endColumn: number) => ({ start: { line: startLine, column: startColumn }, end: { line: endLine, column: endColumn } });
function run(stale = false, corruptCoverage = false, removedSource = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "duel-metrics-"));
  try {
    for (const root of ["app", "hooks", "lib", "convex", "netlify"]) fs.mkdirSync(path.join(directory, root));
    fs.writeFileSync(path.join(directory, "proxy.ts"), source);
    const file = path.join(directory, "proxy.ts");
    const input = { [file]: { path: file,
      statementMap: { 0: loc(2, 2, 2, 27), 1: loc(3, 2, 3, 11), 2: loc(5, 4, 5, 13) }, s: { 0: 0, 1: 0, 2: 1 },
      fnMap: {
        0: { name: "outer", decl: loc(1, 16, 1, 21), loc: loc(1, 0, 7, 1) },
        1: { name: "inner", decl: loc(4, 11, 4, 16), loc: loc(4, 2, 6, 3) },
      }, f: { 0: 0, 1: 1 },
      branchMap: { 0: { type: "if", loc: loc(2, 2, 2, 27), locations: [loc(2, 12, 2, 27), loc(3, 2, 3, 11)] } }, b: { 0: [0, 0] },
    } };
    fs.writeFileSync(path.join(directory, "coverage.json"), JSON.stringify(input));
    fs.writeFileSync(path.join(directory, "source-hashes.json"), JSON.stringify({ testExitCode: 0, instrumentation: "istanbul",
      coverageSha256: corruptCoverage ? "wrong-digest" : createHash("sha256").update(JSON.stringify(input)).digest("hex"),
      sourceHashes: { ...(removedSource ? { "app/deleted.ts": "previous-hash" } : {}), "proxy.ts": stale ? "wrong-hash" : createHash("sha256").update(source).digest("hex") } }));
    execFileSync(process.execPath, [script, "coverage.json", "metrics.json"], { cwd: directory });
    return JSON.parse(fs.readFileSync(path.join(directory, "metrics.json"), "utf8")) as {
      coverageFresh: boolean; passes: boolean; changedSinceCoverage: string[];
      functions: Array<{ name: string; complexity: number; coverageBasis: string; coverageFraction: number | null; crap: number | null; branchIds: string[]; statementIds: string[] }>;
    };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

describe("syntax and coverage metric attribution", () => {
  it("keeps nested execution out of the parent and does not invent unmapped coverage", () => {
    const result = run();
    expect(result.coverageFresh).toBe(true);
    expect(result.functions).toHaveLength(3);
    expect(result.functions.find(fn => fn.name === "outer")).toMatchObject({ complexity: 2, coverageBasis: "branch", coverageFraction: 0,
      crap: 6, branchIds: ["0"], statementIds: ["0", "1"] });
    expect(result.functions.find(fn => fn.name === "inner")).toMatchObject({ complexity: 1, coverageBasis: "statement", coverageFraction: 1,
      crap: 1, branchIds: [], statementIds: ["2"] });
    expect(result.functions.find(fn => fn.name === "unmapped")).toMatchObject({ coverageBasis: "unmapped", coverageFraction: null, crap: null });
    expect(result.passes).toBe(false);
  });
  it("rejects coverage replaced after its manifest was saved", () => {
    expect(run(false, true).coverageFresh).toBe(false);
  });
  it("rejects coverage from a different source snapshot", () => {
    const result = run(true);
    expect(result.coverageFresh).toBe(false);
    expect(result.changedSinceCoverage).toEqual(["proxy.ts"]);
    expect(result.passes).toBe(false);
  });
});


it("rejects measurements that still include a deleted production source", () => {
  const result = run(false, false, true);
  expect(result.coverageFresh).toBe(false);
  expect(result.changedSinceCoverage).toEqual(["app/deleted.ts"]);
});
