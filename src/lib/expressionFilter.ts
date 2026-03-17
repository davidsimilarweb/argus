export interface ExpressionCompileResult<T> {
  predicate: ((item: T) => boolean) | null;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Compiles an arbitrary JS expression into a predicate that runs against each item.
 * The expression is evaluated in a `with (input)` scope so fields can be referenced directly.
 */
export function compileExpression<T = Record<string, unknown>>(
  expression: string,
): ExpressionCompileResult<T> {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { predicate: null, error: 'Expression cannot be empty.' };
  }

  let evaluator: (item: T) => unknown;
  try {
    // eslint-disable-next-line no-new-func
    evaluator = new Function(
      'item',
      `const input = item ?? {};\nwith (input) {\n  return (${trimmed});\n}`,
    ) as (item: T) => unknown;
  } catch (error) {
    return { predicate: null, error: `Invalid expression: ${getErrorMessage(error)}` };
  }

  return {
    predicate: (item: T) => {
      try {
        return Boolean(evaluator(item));
      } catch {
        return false;
      }
    },
    error: null,
  };
}
