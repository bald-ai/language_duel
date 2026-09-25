/** All-source quality gate. See scripts/QUALITY.md for metric definitions. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";
import coverageLibrary from "istanbul-lib-coverage";

const root = process.cwd();
const input = process.argv[2] ?? "reports/quality/current-coverage/coverage-final.json";
const output = process.argv[3];
const manifestPath = path.join(path.dirname(input), "source-hashes.json");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
const raw = JSON.parse(fs.readFileSync(input, "utf8"));
const coverage = new Map(Object.entries(raw).map(([file, data]) => [path.relative(root, fs.realpathSync(file)), data]));
const isFunction = node => (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node)) && node.body;
const roots = ["app", "hooks", "lib", "convex", "netlify"];
function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.name === "_generated") return [];
    return entry.isDirectory() ? filesIn(file) : /\.(tsx?|[cm]?js)$/.test(file) && !file.endsWith(".d.ts") ? [file] : [];
  });
}
const files = [...roots.flatMap(filesIn), "proxy.ts"].sort();
function component(file) {
  if (file.startsWith("app/api/")) return "api";
  if (file.startsWith("app/") || file.startsWith("hooks/")) return "frontend";
  if (file === "proxy.ts") return "proxy";
  return file.split("/")[0];
}
const components = {};
const functions = [];
const missingFiles = [];
const declarationOnlyFiles = [];
const hashes = {};
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  hashes[file] = crypto.createHash("sha256").update(source).digest("hex");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw new Error(`Cannot parse ${file}`);
  const data = coverage.get(file);
  const group = component(file);
  components[group] ??= { files: [], summary: coverageLibrary.createCoverageSummary() };
  components[group].files.push(file);
  if (data) components[group].summary.merge(coverageLibrary.createFileCoverage(data).toSummary());
  else if (ast.statements.every(node =>
    ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ||
    ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEmptyStatement(node)
  )) declarationOnlyFiles.push(file);
  else missingFiles.push(file);
  const nodes = [];
  function gather(node) { if (isFunction(node)) nodes.push(node); ts.forEachChild(node, gather); }
  gather(ast);
  const pos = loc => ast.getPositionOfLineAndCharacter(loc.line - 1, loc.column);
  // Attribute each counter to the smallest syntax function containing its start.
  // This prevents a covered nested callback from covering its uncalled parent.
  function owner(loc) {
    const start = pos(loc.start);
    return nodes.filter(node => start >= node.getStart(ast) && start < node.end)
      .sort((a, b) => (a.end - a.pos) - (b.end - b.pos))[0];
  }
  for (const node of nodes) {
    let complexity = 1;
    function count(child) {
      if (child !== node && isFunction(child)) return;
      if (ts.isIfStatement(child) || ts.isConditionalExpression(child) || ts.isForStatement(child) || ts.isForInStatement(child) || ts.isForOfStatement(child) || ts.isWhileStatement(child) || ts.isDoStatement(child) || ts.isCatchClause(child) || ts.isCaseClause(child)) complexity++;
      if (ts.isBinaryExpression(child) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(child.operatorToken.kind)) complexity++;
      if (child.questionDotToken) complexity++;
      ts.forEachChild(child, count);
    }
    count(node);
    const start = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    const end = ast.getLineAndCharacterOfPosition(node.end);
    let name = node.name?.getText(ast);
    if (!name && (ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent))) name = node.parent.name.getText(ast);
    const branchIds = data ? Object.keys(data.branchMap).filter(id => owner(data.branchMap[id].loc) === node) : [];
    const statementIds = data ? Object.keys(data.statementMap).filter(id => owner(data.statementMap[id]) === node) : [];
    const functionIds = data ? Object.keys(data.fnMap).filter(id => {
      const fn = data.fnMap[id];
      const decl = fn.decl ?? fn.loc;
      return owner(decl) === node && owner(fn.loc) === node;
    }) : [];
    let basis = "unmapped", hits = [];
    if (branchIds.length) { basis = "branch"; hits = branchIds.flatMap(id => data.b[id]); }
    else if (statementIds.length) { basis = "statement"; hits = statementIds.map(id => data.s[id]); }
    else if (functionIds.length) { basis = "function-execution"; hits = functionIds.map(id => data.f[id]); }
    const covered = hits.filter(hit => hit > 0).length;
    const fraction = hits.length ? covered / hits.length : null;
    functions.push({ file, component: group, name: name ?? "(anonymous)", start: { line: start.line + 1, column: start.character }, end: { line: end.line + 1, column: end.character }, complexity, coverageBasis: basis, covered, total: hits.length, coverageFraction: fraction, branchIds, statementIds, functionIds, crap: fraction === null ? null : complexity ** 2 * (1 - fraction) ** 3 + complexity });
  }
}
for (const [group, item] of Object.entries(components)) {
  const fns = functions.filter(fn => fn.component === group);
  item.coverage = item.summary.toJSON(); delete item.summary;
  item.functionCount = fns.length;
  item.unmappedFunctions = fns.filter(fn => fn.crap === null).length;
  item.maxComplexity = Math.max(0, ...fns.map(fn => fn.complexity));
  item.complexityOver8 = fns.filter(fn => fn.complexity > 8).length;
  item.maxCrap = Math.max(0, ...fns.map(fn => fn.crap ?? 0));
  item.crapOver8 = fns.filter(fn => fn.crap !== null && fn.crap > 8).length;
  item.passes = item.coverage.lines.pct >= 90 && item.coverage.branches.pct >= 85 && item.crapOver8 === 0 && item.unmappedFunctions === 0 && !item.files.some(file => missingFiles.includes(file));
}
const changedSinceCoverage = manifest
  ? [...new Set([...files, ...Object.keys(manifest.sourceHashes)])]
    .filter(file => manifest.sourceHashes[file] !== hashes[file])
  : files;
const coverageDigest = crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex");
const provenanceValid = manifest !== null && ["istanbul", "v8"].includes(manifest.instrumentation)
  && manifest.coverageSha256 === coverageDigest;
const coverageFresh = provenanceValid && changedSinceCoverage.length === 0 && manifest.testExitCode === 0;
const result = { provenanceValid, instrumentation: manifest?.instrumentation ?? "unspecified", declarationOnlyFiles, coverageFresh, changedSinceCoverage, generatedAt: new Date().toISOString(), parser: `TypeScript ${ts.version}`, input, sourceHashes: hashes, missingFiles, components, functions, passes: coverageFresh && Object.values(components).every(item => item.passes) };
if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.table(Object.fromEntries(Object.entries(components).map(([group, c]) => [group, { files: c.files.length, lines: c.coverage.lines.pct, branches: c.coverage.branches.pct, maxCC: c.maxComplexity, ccOver8: c.complexityOver8, maxCrap: +c.maxCrap.toFixed(2), crapOver8: c.crapOver8, unmapped: c.unmappedFunctions }])));
console.log(`Missing coverage files: ${missingFiles.length}; gate: ${result.passes ? "PASS" : "FAIL"}`);
if (process.argv.includes("--check") && !result.passes) process.exitCode = 1;
