export function memoizeSelector<TArgs extends unknown[], TResult>(
  projector: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  let hasCache = false;
  let lastArgs: TArgs | null = null;
  let lastResult: TResult;

  return (...args: TArgs): TResult => {
    const cachedArgs = lastArgs;
    if (
      hasCache &&
      cachedArgs &&
      args.length === cachedArgs.length &&
      args.every((value, index) => Object.is(value, cachedArgs[index]))
    ) {
      return lastResult;
    }
    lastResult = projector(...args);
    lastArgs = args;
    hasCache = true;
    return lastResult;
  };
}
