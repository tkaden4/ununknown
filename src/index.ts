import { Either, left, right, isLeft, chain, isRight, Right, Left } from "fp-ts/lib/Either";
import { difference } from "fp-ts/lib/Set";
import { eqString } from "fp-ts/lib/Eq";
import { TypeNameToPrimitive, PrimitiveString } from "./util";

export type ParseError = string;
export type ValidateResult<R> = Either<ParseError, R>;
export type Validator<R> = (o: unknown) => ValidateResult<R>;

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

export function isSuccess<R>(result: ValidateResult<R>): result is Right<R> {
  return isRight(result);
}

export function isFailure<R>(result: ValidateResult<R>): result is Left<string> {
  return isLeft(result);
}

export module object {
  export type FieldValidator<FieldName extends string | number | symbol, R> = (o: FieldName) => Validator<R>;

  type _FieldValidatorResult<D> = D extends FieldValidator<infer F, infer R> ? R : never;

  export type OptionalKeys<Fields> = {
    [X in keyof Fields]: Fields[X] extends FieldValidator<infer F, infer R> ? (R extends undefined ? X : never) : never;
  }[keyof Fields];

  export type NonOptionalKeys<Fields> = Exclude<keyof Fields, OptionalKeys<Fields>>;

  export type FieldsResult<Fields> = {
    [X in OptionalKeys<Fields>]?: _FieldValidatorResult<Fields[X]>;
  } &
    {
      [X in NonOptionalKeys<Fields>]: _FieldValidatorResult<Fields[X]>;
    };

  export function optional<F extends string | number | symbol, R>(
    validator: Validator<R>
  ): FieldValidator<F, R | undefined> {
    return field => o => {
      if (field in (o as any)) {
        return validator((o as any)[field]);
      } else {
        return right(undefined);
      }
    };
  }

  export function required<F extends string | number | symbol, R>(validator: Validator<R>): FieldValidator<F, R> {
    return field => o => {
      if (field in (o as any)) {
        return validator((o as any)[field]);
      } else {
        return left(`${JSON.stringify(o)} does not contain field ${field}`);
      }
    };
  }

  /**
   * Check that object satisfies certain conditions on it's fields.
   * Does not ensure that the object has more fields than listed in `fieldsValidators`.
   *
   * @param fieldsValidators validators for each field.
   */
  export function has<Fields>(
    fieldsValidators: { [X in keyof Fields]: FieldValidator<X, Fields[X]> }
  ): Validator<{ [X in keyof Fields]: Fields[X] }> {
    return o =>
      chain(obj => {
        // Todo use Validated to improve errors
        for (const fieldName in fieldsValidators) {
          const result = fieldsValidators[fieldName](fieldName)(obj);
          if (isLeft(result)) {
            return result;
          }
        }
        return right(obj as { [X in keyof Fields]: Fields[X] });
      })(primitive("object")(o));
  }

  /**
   * Check that object has only the fields listed, and no more.
   *
   * @example
   * ```typescript
   * interface RGBColor {
   *   r: number;
   *   g: number;
   *   b: number;
   * }
   *
   * const rbgColorValidator: Validator<RGBColor> = just({
   *   r: required(primitive("number")),
   *   g: required(primitive("number")),
   *   b: required(primitive("number"))
   * });
   * ```
   */
  export function just<Fields>(
    fieldsValidators: { [X in keyof Fields]: FieldValidator<X, Fields[X]> }
  ): Validator<FieldsResult<{ [X in keyof Fields]: FieldValidator<X, Fields[X]> }>> {
    return o =>
      chain((all: Fields) => {
        const thisKeys = new Set(Object.keys(all as any));
        const validatorKeys = new Set(Object.keys(fieldsValidators));
        const diff = difference(eqString)(thisKeys, validatorKeys);
        if (!Array.from(diff).every(x => x in fieldsValidators)) {
          return left(
            `${JSON.stringify(all)} has extra fields not present in ${JSON.stringify(
              Object.keys(fieldsValidators)
            )}: ${JSON.stringify(diff)}`
          );
        }
        return right(all as any);
      })(has(fieldsValidators)(o));
  }
}
