import { Either, left, right, isLeft, chain, isRight, Right, Left } from "fp-ts/lib/Either";
import _ from "lodash";
import { difference } from "fp-ts/lib/Set";
import { eqString } from "fp-ts/lib/Eq";
import { TypeNameToPrimitive, PrimitiveString, Primitive } from "./util";

export type ParseError = string;
export type ValidateResult<Error, R> = Either<Error, R>;
export type Validator<R, E = ParseError> = (o: unknown) => ValidateResult<E, R>;

export type FieldValidator<FieldName extends string | number | symbol, R> = (o: FieldName) => Validator<R>;

export type FieldValidatorResult<D> = D extends FieldValidator<infer _, infer R> ? R : never;

export type OptionalKeys<Fields> = {
  [X in keyof Fields]: Fields[X] extends FieldValidator<infer _, infer R> ? (R extends undefined ? X : never) : never;
}[keyof Fields];

export type NonOptionalKeys<Fields> = Exclude<keyof Fields, OptionalKeys<Fields>>;

export type FieldsResult<Fields> = {
  [X in OptionalKeys<Fields>]?: FieldValidatorResult<Fields[X]>;
} &
  {
    [X in NonOptionalKeys<Fields>]: FieldValidatorResult<Fields[X]>;
  };

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
 *   object.just({
 *     value: field.required(thing.is.string),
 *     children: field.required(array.of(roseTreeValidator))
 *   })
 * );
 * ```
 *
 * @param body A thunk that returns a parser, possibly one that references itself.
 */
export function recursive<R>(body: () => Validator<R>): Validator<R> {
  return o => body()(o);
}

/**
 * Run two validators on an unknown, failing if either fail and succeeding when both succeed.
 */
export function both<T, U>(fst: Validator<T>, snd: Validator<U>): Validator<T & U> {
  return o => chain(() => snd(o) as Either<string, T & U>)(fst(o));
}

/**
 * Run two validators on an unknown, succeeding if either succeed and failing if both fail.
 */
export function or<T, U>(fst: Validator<T>, snd: Validator<U>): Validator<T | U> {
  return o => {
    const fres = fst(o);
    const sres = snd(o);
    if (isFailure(fres) && isFailure(sres)) {
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
  if (isFailure(result)) {
    throw new Error(result.left);
  }
  return result.right;
}

export function isSuccess<R, E>(result: ValidateResult<E, R>): result is Right<R> {
  return isRight(result);
}

export function isFailure<R, E>(result: ValidateResult<E, R>): result is Left<E> {
  return isLeft(result);
}

export const predicate = <K extends PrimitiveString>(type: K) => (
  p: (s: TypeNameToPrimitive<K>) => boolean,
  template: (s: TypeNameToPrimitive<K>) => string = s => `${s} did not satisfy custom constraint`
): Validator<TypeNameToPrimitive<K>> => o =>
  chain((s: TypeNameToPrimitive<K>) => (p(s) ? right(s) : left(template(s))))(thing.is.of(type)(o));

export module thing {
  export module is {
    /**
     * Ensure that the input value is one the many primitive javascript objects.
     * @param type string representing the `typeof` string for the object.
     */
    export function of<K extends PrimitiveString>(type: K): Validator<TypeNameToPrimitive<K>> {
      return o => {
        if (typeof o === type) {
          return right(o as any);
        } else {
          return left(`${JSON.stringify(o)} is not of type ${JSON.stringify(type)}`);
        }
      };
    }

    export const symbol = of("symbol");
    export const string = of("string");
    export const func = of("function");
    export const object = of("object");
    export const undef = of("undefined");
    export const bigint = of("bigint");
    export const boolean = of("boolean");
    export const number = of("number");
    export const array = predicate("object")(Array.isArray);

    /**
     * Check that the input value is equal to `object` (_.isEqual, works with objects).
     */
    export function equalTo<K>(object: K): Validator<K> {
      return o =>
        _.isEqual(object, o) ? right(o as K) : left(`${JSON.stringify(o)} is not equal to ${JSON.stringify(object)}`);
    }

    export module not {
      /**
       * Ensure that the input value is not one the specific primitive javascript objects.
       * @param type string representing the `typeof` string for the object to exclude.
       */
      export function of<K extends PrimitiveString>(
        type: K
      ): Validator<TypeNameToPrimitive<Exclude<PrimitiveString, K>>> {
        return o =>
          isFailure(is.of(type)(o)) ? right(o as any) : left(`${JSON.stringify(o)} is of type ${JSON.stringify(type)}`);
      }

      export const symbol = of("symbol");
      export const string = of("string");
      export const func = of("function");
      export const object = of("object");
      export const undef = of("undefined");
      export const bigint = of("bigint");
      export const boolean = of("boolean");
      export const number = of("number");
      export const array = predicate("object")(Array.isArray);

      // type Not<K> = K extends Primitive ? Exclude<> : never;

      /**
       * Check that the input value is not equal to `object` (`===`).
       */
      // export function equalTo<K>(object: K): Validator<K> {
      //   return o =>
      //     isFailure(is.equalTo(object)(o))
      //       ? right(o as K)
      //       : left(`${JSON.stringify(o)} is equal to ${JSON.stringify(object)}`);
      // }
    }
  }
}

// dummy variable so we can define `predicate` in child modules
const p = predicate;

export module boolean {
  export const isTrue = predicate("boolean")(
    s => s,
    () => `expected true, got false`
  ) as Validator<true>;

  export const isFalse = predicate("boolean")(
    s => !s,
    () => `expected false, got true`
  ) as Validator<false>;
}

export module field {
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
}

export module bigint {
  export const predicate = p("bigint");
}

export module undef {}

export module object {
  export const predicate = p("object");

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
          if (isFailure(result)) {
            return result;
          }
        }
        return right(obj as { [X in keyof Fields]: Fields[X] });
      })(thing.is.object(o));
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
   * const rbgColorValidator: Validator<RGBColor> = object.just({
   *   r: field.required(number.range.inclusive(0, 255)),
   *   g: field.required(number.range.inclusive(0, 255)),
   *   b: field.required(number.range.inclusive(0, 255))
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

export module func {
  export const predicate = p("function");
}

export module symbol {
  export const predicate = p("symbol");
}

export module string {
  export const predicate = p("string");

  export const length = (n: number) =>
    predicate(
      s => s.length === n,
      s => `${JSON.stringify(s)} is required to be of length ${n}, got ${s.length}`
    );

  export const pattern = (pattern: string | RegExp) =>
    predicate(
      s => s.match(pattern) !== null,
      s => `${JSON.stringify(s)} does not match pattern ${JSON.stringify(pattern)}`
    );
}

export module number {
  export const predicate = p("number");

  export module range {
    export const exclusive = (from: number, to: number) =>
      predicate(
        n => n > from && n < to,
        n => `${n} is not in range (${from},${to})`
      );

    export const inclusive = (from: number, to: number) =>
      predicate(
        n => n >= from && n <= to,
        n => `${n} is not in range [${from},${to}]`
      );
  }
}

export module array {
  /**
   * Check that the input value is an array satisfying constraints.
   *
   * @param validator Check for each element of the input array.
   */
  export function of<Value>(validator: Validator<Value>): Validator<Array<Value>> {
    return o => {
      if (Array.isArray(o)) {
        const results = o.map(each => validator(each)).filter(isFailure);
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
}
