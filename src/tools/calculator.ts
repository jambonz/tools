import type { JambonzTool, ToolSchema } from '../types.js';

const schema: ToolSchema = {
  name: 'calculator',
  description: 'Evaluate a mathematical expression and return the numeric result. '
    + 'Supports arithmetic (+, -, *, /, ^, %), parentheses, and functions '
    + '(sqrt, abs, round, ceil, floor, sin, cos, tan, log, log10, exp). '
    + 'Also supports constants pi and e.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The math expression to evaluate, e.g. "15% of 87.50" should be sent as "87.50 * 0.15"',
      },
    },
    required: ['expression'],
  },
};

/**
 * Create a safe math calculator tool.
 *
 * Uses a recursive descent parser — no eval() — to safely evaluate
 * arithmetic expressions. Ideal for voice agents handling calculations
 * like tips, conversions, or simple math.
 */
export function createCalculator(): JambonzTool {
  return {
    schema,
    async execute(args: Record<string, any>): Promise<string> {
      const expression = (args.expression as string).trim();
      try {
        const result = evaluate(expression);
        /* format nicely: avoid excessive decimals */
        const formatted = Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(10)).toString();
        return `${expression} = ${formatted}`;
      } catch (err) {
        return `Could not evaluate "${expression}": ${(err as Error).message}`;
      }
    },
  };
}

/* ---------- Safe expression evaluator (recursive descent parser) ---------- */

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  ceil: Math.ceil,
  floor: Math.floor,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

interface Parser {
  expr: string;
  pos: number;
}

function evaluate(expr: string): number {
  const parser: Parser = { expr, pos: 0 };
  const result = parseExpression(parser);
  skipWhitespace(parser);
  if (parser.pos < parser.expr.length) {
    throw new Error(`Unexpected character: '${parser.expr[parser.pos]}'`);
  }
  return result;
}

function skipWhitespace(p: Parser): void {
  while (p.pos < p.expr.length && p.expr[p.pos] === ' ') p.pos++;
}

function parseExpression(p: Parser): number {
  let left = parseTerm(p);
  skipWhitespace(p);
  while (p.pos < p.expr.length && (p.expr[p.pos] === '+' || p.expr[p.pos] === '-')) {
    const op = p.expr[p.pos++];
    const right = parseTerm(p);
    left = op === '+' ? left + right : left - right;
    skipWhitespace(p);
  }
  return left;
}

function parseTerm(p: Parser): number {
  let left = parsePower(p);
  skipWhitespace(p);
  while (p.pos < p.expr.length && (p.expr[p.pos] === '*' || p.expr[p.pos] === '/' || p.expr[p.pos] === '%')) {
    const op = p.expr[p.pos++];
    const right = parsePower(p);
    if (op === '*') left *= right;
    else if (op === '/') left /= right;
    else left %= right;
    skipWhitespace(p);
  }
  return left;
}

function parsePower(p: Parser): number {
  const base = parseUnary(p);
  skipWhitespace(p);
  if (p.pos < p.expr.length && (p.expr[p.pos] === '^' || (p.expr[p.pos] === '*' && p.expr[p.pos + 1] === '*'))) {
    if (p.expr[p.pos] === '*') p.pos += 2; else p.pos++;
    const exp = parsePower(p); /* right-associative */
    return Math.pow(base, exp);
  }
  return base;
}

function parseUnary(p: Parser): number {
  skipWhitespace(p);
  if (p.pos < p.expr.length && p.expr[p.pos] === '-') {
    p.pos++;
    return -parseUnary(p);
  }
  if (p.pos < p.expr.length && p.expr[p.pos] === '+') {
    p.pos++;
    return parseUnary(p);
  }
  return parseAtom(p);
}

function parseAtom(p: Parser): number {
  skipWhitespace(p);

  /* parenthesized expression */
  if (p.pos < p.expr.length && p.expr[p.pos] === '(') {
    p.pos++;
    const val = parseExpression(p);
    skipWhitespace(p);
    if (p.pos >= p.expr.length || p.expr[p.pos] !== ')') {
      throw new Error('Missing closing parenthesis');
    }
    p.pos++;
    return val;
  }

  /* number */
  if (p.pos < p.expr.length && (isDigit(p.expr[p.pos]) || p.expr[p.pos] === '.')) {
    return parseNumber(p);
  }

  /* identifier: function or constant */
  if (p.pos < p.expr.length && isAlpha(p.expr[p.pos])) {
    const name = parseIdentifier(p);
    const lower = name.toLowerCase();
    skipWhitespace(p);

    /* function call */
    if (p.pos < p.expr.length && p.expr[p.pos] === '(') {
      const fn = FUNCTIONS[lower];
      if (!fn) throw new Error(`Unknown function: ${name}`);
      p.pos++;
      const arg = parseExpression(p);
      skipWhitespace(p);
      if (p.pos >= p.expr.length || p.expr[p.pos] !== ')') {
        throw new Error(`Missing closing parenthesis for ${name}()`);
      }
      p.pos++;
      return fn(arg);
    }

    /* constant */
    if (lower in CONSTANTS) return CONSTANTS[lower];
    throw new Error(`Unknown identifier: ${name}`);
  }

  throw new Error(
    p.pos < p.expr.length
      ? `Unexpected character: '${p.expr[p.pos]}'`
      : 'Unexpected end of expression'
  );
}

function parseNumber(p: Parser): number {
  const start = p.pos;
  while (p.pos < p.expr.length && (isDigit(p.expr[p.pos]) || p.expr[p.pos] === '.')) p.pos++;
  const num = parseFloat(p.expr.slice(start, p.pos));
  if (isNaN(num)) throw new Error(`Invalid number at position ${start}`);
  return num;
}

function parseIdentifier(p: Parser): string {
  const start = p.pos;
  while (p.pos < p.expr.length && (isAlpha(p.expr[p.pos]) || isDigit(p.expr[p.pos]))) p.pos++;
  return p.expr.slice(start, p.pos);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}
