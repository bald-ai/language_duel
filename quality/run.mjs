/** Capture a fresh coverage run and gate all handwritten production components. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

if (!process.env.VERIFICATION_SESSION_ROOT) {
  const child = spawnSync("python3", ["scripts/verification-session.py", "metrics"], { stdio: "inherit" });
  process.exit(child.status ?? 1);
}
const reportDir = "reports/quality";
const coverageDir = `${reportDir}/current-coverage`;
fs.mkdirSync(reportDir, { recursive: true });
function snapshot(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === "_generated") return [];
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return snapshot(file);
    return /\.(tsx?|[cm]?js)$/.test(file) && !file.endsWith(".d.ts") ? [file] : [];
  });
}
const files = [...["app", "hooks", "lib", "convex", "netlify"].flatMap(snapshot), "proxy.ts"];
const sourceHashes = Object.fromEntries(files.map(file => [file,
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
const args = ["run", "test:run", "--", "--coverage", "--coverage.provider=istanbul", `--coverage.reportsDirectory=${coverageDir}`, "--coverage.reporter=json", "--coverage.reporter=json-summary",
  "--coverage.thresholds.lines=0", "--coverage.thresholds.branches=0", "--coverage.thresholds.functions=0",
  "--coverage.thresholds.statements=0", "--reporter=default", "--reporter=json", `--outputFile=${reportDir}/current-tests.json`];
fs.rmSync(coverageDir, { recursive: true, force: true });
const log = fs.openSync(`${reportDir}/current-tests.log`, "w");
const startedAt = new Date().toISOString();
const tests = spawnSync("npm", args, { stdio: ["ignore", log, log],
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --no-experimental-webstorage`.trim() } });
fs.closeSync(log);
fs.writeFileSync(`${reportDir}/current-tests.exit`, `${tests.status}\n`);
fs.mkdirSync(coverageDir, { recursive: true });
fs.writeFileSync(`${coverageDir}/source-hashes.json`, JSON.stringify({ sourceHashes, startedAt, instrumentation: "istanbul",
  coverageSha256: fs.existsSync(`${coverageDir}/coverage-final.json`)
    ? crypto.createHash("sha256").update(fs.readFileSync(`${coverageDir}/coverage-final.json`)).digest("hex") : null,
  finishedAt: new Date().toISOString(), testExitCode: tests.status, command: ["npm", ...args] }, null, 2));
const metrics = spawnSync(process.execPath, ["quality/metrics.mjs", `${coverageDir}/coverage-final.json`,
  `${reportDir}/current-metrics.json`, "--check"], { stdio: "inherit" });
process.exitCode = tests.status === 0 && metrics.status === 0 ? 0 : 1;
