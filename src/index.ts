import { Either, left, right, isLeft, chain } from "fp-ts/lib/Either";
import { TypeNameToPrimitive, PrimitiveString } from "./util";

export type ParseError = string;
export type Validator<R> = (o: unknown) => Either<ParseError, R>;

/**
 * Ensure that the input value is one the many primitive javascript objects.
 * @param type string representing the `typeof` string for the object.
 */
export function primitive<T extends TypeNameToPrimitive<K>, K extends PrimitiveString>(type: K): Validator<T> {
  return o => {
    if (typeof o === type) {
      return right(o as T);
    } else {
      return left(`${JSON.stringify(o)} is not of type ${JSON.stringify(type)}`);
    }
  };
}

/**
 * Check that the input value is equal to `object` (`===`).
 */
export function equals<K>(object: K): Validator<K> {
  return o => (o === object ? right(o as K) : left(`${JSON.stringify(o)} is not equal to ${JSON.stringify(object)}`));
}

/**
 * Check that the input value is an array satisfying constraints.
 *
 * @param validator Check for each element of the input array.
 */
export function array<Value>(validator: Validator<Value>): Validator<Array<Value>> {
  return o => {
    if (Array.isArray(o)) {
      const results = o.map(each => validator(each)).filter(isLeft);
      if (results.length > 0) {
        return left(`${JSON.stringify(o)} is an invalid array: ${results.map(x => x.left).join(", ")}`);
      } else {
        return right(o);
      }
    } else {
      return left(`${JSON.stringify(o)} is not an array`);
    }
  };
}

/**
 * Due to javascript not being a "lazy" language, we have to embed recursive references to
 * validators in a thunk, like so:
 *
 * @example
 * ```typescript
 * interface RoseTree {
 *   value: string;
 *   children: Array<RoseTree>;
 * }
 *
 * const roseTreeValidator: Validator<RoseTree> = recursive(() =>
 *   just({
 *     value: required(primitive("string")),
 *     children: required(array(roseTreeValidator))
 *   })
 * );
 * ```
 *
 * @param body A thunk that returns a parser, possibly one that references itself.
 */
export function recursive<R>(body: () => Validator<R>): Validator<R> {
  return o => body()(o);
}

export function both<T, U>(fst: Validator<T>, snd: Validator<U>): Validator<T & U> {
  return o => chain(() => snd(o) as Either<string, T & U>)(fst(o));
}

export function or<T, U>(fst: Validator<T>, snd: Validator<U>): Validator<T | U> {
  return o => {
    const fres = fst(o);
    const sres = snd(o);
    if (isLeft(fres) && isLeft(sres)) {
      return left(`${fres.left} and ${sres.left}`);
    } else {
      return right(o as T | U);
    }
  };
}

/**
 * Given an anonymous object and a validator, return the object or throw an exception if validation fails.
 *
 * @param o value to validate
 * @param validator the validator to run
 */
export function validateEx<R>(o: unknown, validator: Validator<R>): R | never {
  const result = validator(o);
  if (isLeft(result)) {
    throw new Error(result.left);
  }
  return result.right;
}
