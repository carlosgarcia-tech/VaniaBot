/**
 * Either.ts - Functional programming utilities for Either monad
 *
 * Provides a type-safe way to handle errors without throwing exceptions.
 * Either<L, R> represents a value that can be either a Left (error) or Right (success).
 *
 * @author **Carlos G** ⭐
 */

import type { VBotError } from './errors.js';

/**
 * Either type - represents a value that can be either Left (error) or Right (success)
 */
export type Either<L, R> = { _tag: 'Left'; left: L } | { _tag: 'Right'; right: R };

/**
 * Creates a Left value (typically represents an error)
 */
export function left<L>(value: L): Either<L, never> {
  return { _tag: 'Left', left: value };
}

/**
 * Creates a Right value (typically represents success)
 */
export function right<R>(value: R): Either<never, R> {
  return { _tag: 'Right', right: value };
}

/**
 * Check if Either is a Left
 */
export function isLeft<L, R>(either: Either<L, R>): either is { _tag: 'Left'; left: L } {
  return either._tag === 'Left';
}

/**
 * Check if Either is a Right
 */
export function isRight<L, R>(either: Either<L, R>): either is { _tag: 'Right'; right: R } {
  return either._tag === 'Right';
}

/**
 * Get the value or a default if Left
 */
export function getOrElse<L, R>(either: Either<L, R>, defaultValue: R): R {
  return either._tag === 'Right' ? either.right : defaultValue;
}

/**
 * Get the value or compute a default from the Left
 */
export function getOrElseWith<L, R>(either: Either<L, R>, fn: (l: L) => R): R {
  return either._tag === 'Right' ? either.right : fn(either.left);
}

/**
 * Map over the Right value
 */
export function map<L, R, B>(fn: (r: R) => B): (either: Either<L, R>) => Either<L, B> {
  return either => {
    if (either._tag === 'Right') {
      return right(fn(either.right));
    }
    return either as Either<L, B>;
  };
}

/**
 * Map over the Left value
 */
export function mapLeft<L, R, B>(fn: (l: L) => B): (either: Either<L, R>) => Either<B, R> {
  return either => {
    if (either._tag === 'Left') {
      return left(fn(either.left));
    }
    return either as Either<B, R>;
  };
}

/**
 * FlatMap/Chain
 */
export function flatMap<L, R, L2, R2>(
  fn: (r: R) => Either<L2, R2>,
): (either: Either<L, R>) => Either<L | L2, R2> {
  return either => {
    if (either._tag === 'Right') {
      return fn(either.right);
    }
    return either as Either<L | L2, R2>;
  };
}

export { flatMap as andThen };

/**
 * Create Either from nullable value
 */
export function fromNullable<L>(leftValue: L) {
  return <R>(value: R | null | undefined): Either<L, R> => {
    if (value === null || value === undefined) {
      return left(leftValue);
    }
    return right(value);
  };
}

/**
 * Pattern matching
 */
export function match<L, R, B>(
  onLeft: (l: L) => B,
  onRight: (r: R) => B,
): (either: Either<L, R>) => B {
  return either => {
    return either._tag === 'Left' ? onLeft(either.left) : onRight(either.right);
  };
}

export { match as fold };

/**
 * Recover from Left
 */
export function orElse<L, R>(fn: (l: L) => Either<L, R>): (either: Either<L, R>) => Either<L, R> {
  return either => {
    if (either._tag === 'Left') {
      return fn(either.left);
    }
    return either;
  };
}

/**
 * Tap - execute side effects on Right
 */
export function tap<L, R>(fn: (r: R) => void): (either: Either<L, R>) => Either<L, R> {
  return either => {
    if (either._tag === 'Right') {
      fn(either.right);
    }
    return either;
  };
}

/**
 * TapLeft - execute side effects on Left
 */
export function tapLeft<L, R>(fn: (l: L) => void): (either: Either<L, R>) => Either<L, R> {
  return either => {
    if (either._tag === 'Left') {
      fn(either.left);
    }
    return either;
  };
}

/**
 * Combine two Either values - returns first Left
 */
export function and<L, R>(a: Either<L, R>, b: Either<L, R>): Either<L, R> {
  if (a._tag === 'Left') return a;
  if (b._tag === 'Left') return b;
  return b;
}

/**
 * Sequence array of Either
 */
export function sequence<L, R>(eithers: Either<L, R>[]): Either<L, R[]> {
  const results: R[] = [];
  for (const either of eithers) {
    if (either._tag === 'Left') {
      return either as Either<L, R[]>;
    }
    results.push(either.right);
  }
  return right(results);
}

/**
 * Traverse array to Either
 */
export function traverse<L, R, B>(
  array: R[],
  fn: (item: R, index: number) => Either<L, B>,
): Either<L, B[]> {
  const results: B[] = [];
  for (let i = 0; i < array.length; i++) {
    const result = fn(array[i], i);
    if (result._tag === 'Left') {
      return result as Either<L, B[]>;
    }
    results.push(result.right);
  }
  return right(results);
}

/**
 * Swap Left and Right
 */
export function swap<L, R>(either: Either<L, R>): Either<R, L> {
  if (either._tag === 'Left') {
    return right(either.left) as Either<R, L>;
  }
  return left(either.right) as Either<R, L>;
}

/**
 * Extract Left value (unsafe)
 */
export function extractLeft<L, R>(either: Either<L, R>): L {
  if (either._tag === 'Left') {
    return either.left;
  }
  throw new Error('Cannot extract Left from Right');
}

/**
 * Extract Right value (unsafe)
 */
export function extractRight<L, R>(either: Either<L, R>): R {
  if (either._tag === 'Right') {
    return either.right;
  }
  throw new Error('Cannot extract Right from Left');
}

/**
 * Type guard for Either
 */
export function isEither<L, R>(value: unknown): value is Either<L, R> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    (value._tag === 'Left' || value._tag === 'Right')
  );
}

/**
 * Type guard for VBotError
 */
export function isVBotError(value: unknown): value is VBotError {
  return value instanceof Error && 'code' in value;
}

/**
 * Unwrap the Right type from Either
 */
export type RightType<T> = T extends Either<infer _L, infer R> ? R : never;

/**
 * Unwrap the Left type from Either
 */
export type LeftType<T> = T extends Either<infer L, infer _R> ? L : never;
