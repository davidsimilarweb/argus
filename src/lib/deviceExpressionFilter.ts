import type { Device } from './api';

export interface DeviceExpressionCompileResult {
  predicate: ((device: Device) => boolean) | null;
  error: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function compileDeviceExpression(expression: string): DeviceExpressionCompileResult {
  const trimmedExpression = expression.trim();
  if (!trimmedExpression) {
    return {
      predicate: null,
      error: 'Expression cannot be empty.',
    };
  }

  let evaluator: (device: Device) => unknown;

  try {
    // Intentionally unsafe/power-user behavior by request:
    // this executes arbitrary JavaScript against each device object.
    // eslint-disable-next-line no-new-func
    evaluator = new Function(
      'device',
      `
const input = device ?? {};
with (input) {
  return (${trimmedExpression});
}
`
    ) as (device: Device) => unknown;
  } catch (error) {
    return {
      predicate: null,
      error: `Invalid expression: ${getErrorMessage(error)}`,
    };
  }

  return {
    predicate: (device: Device) => {
      try {
        return Boolean(evaluator(device));
      } catch {
        return false;
      }
    },
    error: null,
  };
}
