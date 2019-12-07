import { right, left, chain, isLeft } from "fp-ts/lib/Either";
import { difference } from "fp-ts/lib/Set";
import { eqString } from "fp-ts/lib/Eq";
import { Validator, primitive } from "..";

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
