import ts from 'typescript';
import { posix as path } from 'node:path';

// This is a conservative source audit, not a claim that every branch was rendered.
// Follow the app's local runtime imports so closed dialogs, role gates, imported
// labels and lazy panels are checked without signing in or mutating a workspace.
const forbiddenCopy = [
  { name: 'implementation commentary', pattern: /\b(?:implementation|developer|development|task[- ]summary)\s+(?:notes?|commentary|details?|summary)\b/i },
  { name: 'task completion summary', pattern: /\b(?:this (?:change|update|implementation) (?:adds|fixes|preserves|ensures)|now (?:uses|renders|supports) the (?:new|updated)|wired (?:up|into)|not (?:yet )?wired up)\b/i },
  { name: 'traffic-stop routing commentary', pattern: /\b(?:The FTO chooses|supplementform|The form suggestion is based only|10-6 does not determine high risk)\b/i },
  { name: 'editor metric commentary', pattern: /\b(?:runTypeCodeHelp|1V uses the explicitly selected Traffic Citations metric)\b/i },
];

export interface CopyFinding {
  file: string;
  line: number;
  text: string;
  rule: string;
  importChain: string[];
}

const isNonRuntime = (file: string) =>
  /(?:^|\/)(?:__tests__|__fixtures__|test-support|docs)(?:\/|$)|\.(?:test|spec|stories)\.[cm]?[jt]sx?$|\.d\.ts$/.test(file);

function parse(file: string, source: string) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function runtimeImports(source: ts.SourceFile): string[] {
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      const bindings = node.importClause?.namedBindings;
      const onlyTypes = !node.importClause?.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly);
      if (!onlyTypes && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (!argument || !ts.isStringLiteralLike(argument)) {
        throw new Error(`${source.fileName}: copy audit needs an explicit import target for this dynamic panel`);
      }
      imports.push(argument.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return imports;
}

function localTarget(from: string, specifier: string, read: (file: string) => string | undefined) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return undefined;
  const target = specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : path.normalize(path.join(path.dirname(from), specifier));
  // Asset and official-document content is not authored application commentary.
  if (/\.(?:css|svg|png|jpe?g|webp|ico|pdf|json|woff2?)(?:\?.*)?$/.test(target)) return undefined;
  const base = target.replace(/\.[cm]?[jt]sx?$/, '');
  const resolved = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
    .find(candidate => read(candidate) !== undefined);
  if (!resolved) throw new Error(`${from}: unresolved local runtime import ${specifier}; copy coverage is incomplete`);
  return isNonRuntime(resolved) ? undefined : resolved;
}

export function auditCopyGraph(entry: string, read: (file: string) => string | undefined) {
  const modules = new Map<string, string[]>();
  const findings: CopyFinding[] = [];
  function walk(file: string, chain: string[]) {
    if (modules.has(file) || isNonRuntime(file)) return;
    const text = read(file);
    if (text === undefined) throw new Error(`Missing copy audit entry: ${file}`);
    const importChain = [...chain, file];
    modules.set(file, importChain);
    const source = parse(file, text);
    function check(value: string, node: ts.Node) {
      const normalized = value.replace(/\s+/g, ' ').trim();
      for (const rule of forbiddenCopy) {
        if (rule.pattern.test(normalized)) findings.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          text: normalized,
          rule: rule.name,
          importChain,
        });
      }
    }
    function visit(node: ts.Node) {
      // Comments never enter the AST text candidates. Attribute metadata is not
      // operator copy; labels, titles, placeholders and custom component props are.
      if (ts.isJsxAttribute(node) && /^(?:className|class|id|key|style|data-.+)$/.test(node.name.getText(source))) return;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      if (ts.isJsxText(node) || ts.isStringLiteralLike(node)
        || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        check(node.text, node);
      }
      // Also join adjacent literal fragments to catch a phrase split by JSX
      // elements, interpolation, or string concatenation.
      if (ts.isJsxElement(node)) {
        const childText = (child: ts.JsxChild): string => {
          if (ts.isJsxText(child)) return child.text;
          if (ts.isJsxExpression(child) && child.expression && ts.isStringLiteralLike(child.expression)) return child.expression.text;
          if (ts.isJsxElement(child) || ts.isJsxFragment(child)) return child.children.map(childText).join(' ');
          return '';
        };
        const parts = node.children.map(childText);
        check(parts.join(' '), node);
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const literal = (part: ts.Expression): string =>
          ts.isStringLiteralLike(part) ? part.text
            : ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.PlusToken
              ? literal(part.left) + literal(part.right) : '';
        check(literal(node), node);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const specifier of runtimeImports(source)) {
      const target = localTarget(file, specifier, read);
      if (target) walk(target, importChain);
    }
  }
  walk(entry, []);
  return { modules, findings };
}

export function formatCopyFindings(findings: CopyFinding[]) {
  return findings.map(finding =>
    `${finding.file}:${finding.line} [${finding.rule}]\n  Text: ${JSON.stringify(finding.text)}\n  Screen/import path: ${finding.importChain.join(' → ')}`,
  ).join('\n');
}
