import * as ts from 'typescript';
import {
  CodeFinding,
  FileMetrics,
  FunctionMetrics,
  ICodeAnalyzer,
  layerViolation,
  maintainabilityIndex,
} from '../../domain/quality';

const LANGUAGES: Record<string, { language: FileMetrics['language']; kind: ts.ScriptKind }> = {
  '.ts': { language: 'typescript', kind: ts.ScriptKind.TS },
  '.tsx': { language: 'typescript', kind: ts.ScriptKind.TSX },
  '.js': { language: 'javascript', kind: ts.ScriptKind.JS },
  '.jsx': { language: 'javascript', kind: ts.ScriptKind.JSX },
  '.mjs': { language: 'javascript', kind: ts.ScriptKind.JS },
  '.cjs': { language: 'javascript', kind: ts.ScriptKind.JS },
};

const SECRET_NAME = /(password|passwd|secret|api_?key|access_?token|private_?key)/i;

const isFunctionLike = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) ||
  ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);

/**
 * Static analysis of generated TypeScript / JavaScript with the TypeScript compiler's
 * parser (Phase 6, Task 26). Works on text, so files are analysed before they are
 * written (refinement) as well as from the workspace.
 *
 * - syntax errors: the compiler's syntactic diagnostics
 * - cyclomatic complexity per function: 1 + if, ?:, loops, case, catch, &&, ||, ??
 * - Halstead volume from the token stream (identifiers and literals are operands)
 * - security patterns: eval, new Function, innerHTML/outerHTML assignment, document.write,
 *   shell commands built from strings, hard-coded secrets
 * - OOAD layering: imports that point outwards (LayerRules)
 *
 * @pattern Adapter (TypeScript compiler API → ICodeAnalyzer port)
 */
export class TypeScriptCodeAnalyzer implements ICodeAnalyzer {
  analyze(path: string, content: string): FileMetrics | null {
    const ext = (path.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase();
    const lang = LANGUAGES[ext];
    if (!lang) return null;

    const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, lang.kind);
    const line = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const findings: CodeFinding[] = [...this.syntaxErrors(path, content, lang.kind)];
    const functions: FunctionMetrics[] = [];

    const visit = (node: ts.Node) => {
      if (isFunctionLike(node) && node.body) {
        functions.push({ name: this.functionName(node), line: line(node), complexity: 1 + this.decisions(node.body) });
      }
      this.security(node, source, line, findings);
      this.imports(node, path, line, findings);
      ts.forEachChild(node, visit);
    };
    visit(source);

    const lines = content.split('\n');
    const loc = lines.filter(l => l.trim()).length;
    const commentLines = lines.filter(l => /^\s*(\/\/|\/\*|\*)/.test(l)).length;
    const volume = this.halsteadVolume(content, lang.kind === ts.ScriptKind.TSX || lang.kind === ts.ScriptKind.JSX);
    const totalComplexity = functions.reduce((s, f) => s + f.complexity, 0) || 1;
    return {
      path,
      language: lang.language,
      loc,
      commentLines,
      functions,
      maxComplexity: functions.reduce((m, f) => Math.max(m, f.complexity), 0),
      halsteadVolume: Math.round(volume),
      maintainabilityIndex: maintainabilityIndex(volume, totalComplexity, loc),
      useCaseRefs: [...new Set(content.match(/UC-\d{3}/g) ?? [])].sort(),
      findings,
    };
  }

  private syntaxErrors(path: string, content: string, kind: ts.ScriptKind): CodeFinding[] {
    const jsx = kind === ts.ScriptKind.TSX || kind === ts.ScriptKind.JSX;
    const { diagnostics = [] } = ts.transpileModule(content, {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: { allowJs: true, target: ts.ScriptTarget.ES2020, ...(jsx ? { jsx: ts.JsxEmit.Preserve } : {}) },
    });
    return diagnostics
      .filter(d => d.category === ts.DiagnosticCategory.Error && d.file) // option diagnostics have no file
      .slice(0, 10)
      .map(d => ({
        kind: 'syntax' as const,
        rule: `TS${d.code}`,
        line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 1,
        message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
      }));
  }

  private functionName(node: ts.FunctionLikeDeclaration): string {
    if (ts.isConstructorDeclaration(node)) return 'constructor';
    if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isPrivateIdentifier(node.name))) return node.name.text;
    const parent = node.parent;
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    return '(anonymous)';
  }

  /** Decision points inside a function body, not counting nested functions */
  private decisions(body: ts.Node): number {
    let count = 0;
    const walk = (n: ts.Node) => {
      if (isFunctionLike(n)) return;
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
          count++;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const op = (n as ts.BinaryExpression).operatorToken.kind;
          if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) count++;
          break;
        }
      }
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(body, walk);
    return count;
  }

  private security(node: ts.Node, source: ts.SourceFile, line: (n: ts.Node) => number, out: CodeFinding[]): void {
    const add = (rule: string, message: string) => out.push({ kind: 'security', rule, line: line(node), message });
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (callee === 'eval') add('no-eval', 'eval() runs arbitrary code');
      if (callee === 'document.write') add('no-document-write', 'document.write() can inject markup');
      if (/(^|\.)(exec|execSync)$/.test(callee) && node.arguments[0] && !ts.isStringLiteral(node.arguments[0]) && !ts.isNoSubstitutionTemplateLiteral(node.arguments[0])) {
        add('no-shell-injection', `${callee}() with a command built at run time`);
      }
    }
    if (ts.isNewExpression(node) && node.expression.getText(source) === 'Function') add('no-new-function', 'new Function() runs arbitrary code');
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && /^(innerHTML|outerHTML)$/.test(node.left.name.text)) {
      add('no-inner-html', `assignment to ${node.left.name.text} can cause XSS`);
    }
    const named = ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node);
    if (named && node.name && ts.isIdentifier(node.name) && SECRET_NAME.test(node.name.text)) {
      const init = node.initializer;
      if (init && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) && init.text.length >= 8) {
        add('no-hardcoded-secret', `hard-coded value for ${node.name.text}`);
      }
    }
  }

  private imports(node: ts.Node, path: string, line: (n: ts.Node) => number, out: CodeFinding[]): void {
    let specifier: string | null = null;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifier = node.moduleSpecifier.text;
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      specifier = node.arguments[0].text;
    }
    if (!specifier) return;
    const violation = layerViolation(path, specifier);
    if (violation) {
      out.push({ kind: 'layering', rule: 'dependency-direction', line: line(node), message: `${violation.from} layer imports ${violation.to} ('${specifier}')` });
    }
  }

  /** V = N · log2(n): N all operator and operand tokens, n the distinct ones */
  private halsteadVolume(content: string, jsx: boolean): number {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, jsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, content);
    const distinct = new Set<string>();
    let total = 0;
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
      if (kind === ts.SyntaxKind.NewLineTrivia || kind === ts.SyntaxKind.WhitespaceTrivia) continue;
      total++;
      distinct.add(`${kind}:${scanner.getTokenText()}`);
    }
    return distinct.size > 1 ? total * Math.log2(distinct.size) : total;
  }
}
