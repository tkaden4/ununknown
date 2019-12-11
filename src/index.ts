import { left, right, isRight, isLeft, Either, Right, Left } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import _ from "lodash";
import { difference } from "fp-ts/lib/Set";
import { eqString } from "fp-ts/lib/Eq";
import { TypeNameToPrimitive, PrimitiveString } from "./util";

export type ParseResult<Error, R> = Either<Error, R>;
export type Parser<R, E = string, O = unknown> = { runParser: (o: O) => ParseResult<E, R> };
export type ParserReturnType<P> = P extends Parser<infer R, infer _, infer _> ? R : never;

export const from = <R, E, O>(parser: (o: O) => ParseResult<E, R>) => ({ runParser: parser });

export function succeed<R, E, B>(result: R): Parser<R, E, B> {
  return (of(result) as unknown) as Parser<R, E, B>;
}

export function fail<R, E, B>(error: E): Parser<R, E, B> {
  return from(_ => left(error));
}

export function isSuccess<R, E>(result: ParseResult<E, R>): result is Right<R> {
  return isRight(result);
}

export function isFailure<R, E>(result: ParseResult<E, R>): result is Left<E> {
  return isLeft(result);
}

// TODO fix instances to work with fp-ts

// export const URI = "Parser";
// export type URI = typeof URI;

// declare module "fp-ts/lib/HKT" {
//   interface URItoKind<A> {
//     Parser: Parser<A>;
//   }
// }

export const parserFunctor = {
  // URI,
  map: <A, E, B, C>(v: Parser<A, E, C>, f: (a: A) => B): Parser<B, E, C> => from((o: C) => E.map(f)(v.runParser(o)))
};

export const parserApplicative = {
  ...parserFunctor,
  of: <A, E, C>(a: A): Parser<A, E, C> => from((_: C) => right(a)),
  ap: <A, B, E, C>(fab: Parser<(a: A) => B, E, C>, a: Parser<A, E, C>): Parser<B, E, C> =>
    from((o: C) => E.ap(a.runParser(o))(fab.runParser(o)))
};

export const parserMonad = {
  ...parserApplicative,
  chain: <A, B, E, C>(fa: Parser<A, E, C>, afb: (a: A) => Parser<B, E, C>): Parser<B, E, C> =>
    from((o: C) => E.chain((a: A) => afb(a).runParser(o))(fa.runParser(o)))
};

export const map = parserMonad.map;
export const of = parserMonad.of;
export const ap = parserMonad.ap;
export const chain = parserMonad.chain;

export const compose = <A, B, C, E>(vb: Parser<B, E, A>, vc: Parser<C, E, B>): Parser<C, E, A> => {
  return chain(vb, (b: B) => from((_: A) => vc.runParser(b)));
};

/**
 * Due to javascript not being a "lazy" language, we have to embed recursive references to
 * parsers in a thunk, like so:
 *
 * @example
 * ```typescript
 * interface Trie {
 *   value: string;
 *   children: Array<Trie>;
 * }
 *
 * const trieParser: Parser<Trie> = recursive(() =>
 *   object.just({
 *     value: field.required(thing.is.string),
 *     children: field.required(array.of(trieParser))
 *   })
 * );
 * ```
 *
 * @param body A thunk that returns a parser, possibly one that references itself.
 */
export function recursive<R, E, I>(body: () => Parser<R, E, I>): Parser<R, E, I> {
  return from(o => body().runParser(o));
}

/**
 * Run two parsers, failing if either fail and succeeding when both succeed.
 */
export function both<T, U, E, I>(fst: Parser<T, E, I>, snd: Parser<U, E, I>): Parser<[T, U], E, I> {
  return ap(
    map(fst, (t: T) => (u: U) => [t, u]),
    snd
  );
}

/**
 * Run two parsers on an unknown, succeeding if either succeed and failing if both fail.
 */
export function or<T, U, B>(fst: Parser<T, string, B>, snd: Parser<U, string, B>): Parser<T | U, string, B> {
  return from(o => {
    const fres = fst.runParser(o);
    const sres = snd.runParser(o);
    return isSuccess(fres) ? fres : isSuccess(sres) ? sres : left(`${fres.left} and ${sres.left}`);
  });
}

/**
 * Given an object of type B, parse out an object of type R with the possibility of errors of type E
 */
export function runParser<R, E, B>(parser: Parser<R, E, B>, b: B) {
  return parser.runParser(b);
}

/**
 * Given an anonymous object and a parser, return the object or throw an exception if parsing fails.
 *
 * @param o value to parse from
 * @param parser the parser to run
 */
export function runParserEx<R, E extends { toString(): string }, B>(parser: Parser<R, E, B>, o: B): R | never {
  const result = parser.runParser(o);
  if (isFailure(result)) {
    throw new Error(result.left.toString());
  }
  return result.right;
}

export const predicate = <K extends PrimitiveString, I>(type: K) => (
  p: (s: TypeNameToPrimitive<K>) => boolean,
  template: (s: TypeNameToPrimitive<K>) => string = s => `${s} did not satisfy custom constraint`
): Parser<TypeNameToPrimitive<K>, string, I> =>
  from(o =>
    E.chain((s: TypeNameToPrimitive<K>) => (p(s) ? right(s) : left(template(s))))(thing.is.of(type).runParser(o))
  );

export namespace thing {
  export namespace is {
    /**
     * Ensure that the input value is one the many primitive javascript objects.
     * @param type string representing the `typeof` string for the object.
     */
    export function of<K extends PrimitiveString, I>(type: K): Parser<TypeNameToPrimitive<K>, string, I> {
      return from(o => {
        if (typeof o === type) {
          return right((o as unknown) as TypeNameToPrimitive<K>);
        } else {
          return left(`${JSON.stringify(o)} is not of type ${JSON.stringify(type)}`);
        }
      });
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
    export function equalTo<K, I>(object: K): Parser<K, string, I> {
      return from(o =>
        _.isEqual(object, o)
          ? right((o as unknown) as K)
          : left(`${JSON.stringify(o)} is not equal to ${JSON.stringify(object)}`)
      );
    }

    export namespace not {
      /**
       * Ensure that the input value is not one the specific primitive javascript objects.
       * @param type string representing the `typeof` string for the object to exclude.
       */
      export function of<K extends PrimitiveString, I>(
        type: K
      ): Parser<TypeNameToPrimitive<Exclude<PrimitiveString, K>>, string, I> {
        return from(o =>
          isFailure(is.of(type).runParser(o))
            ? right((o as unknown) as TypeNameToPrimitive<Exclude<PrimitiveString, K>>)
            : left(`${JSON.stringify(o)} is of type ${JSON.stringify(type)}`)
        );
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
    }
  }
}

// dummy variable so we can define `predicate` in child modules
const p = predicate;

export namespace boolean {
  export const isTrue = predicate("boolean")(
    s => s,
    () => `expected true, got false`
  ) as Parser<true>;

  export const isFalse = predicate("boolean")(
    s => !s,
    () => `expected false, got true`
  ) as Parser<false>;
}

export namespace field {
  export type Field = string | number | symbol;
  export type Fields<K> = { [X in keyof K]: X }[keyof K];
  export type FieldType = "dependent" | "required" | "optional";

  export type FieldParser<FieldName extends string | number | symbol, R, E = string, I = object> =
    | {
        type: "required" | "optional";
        run: (o: FieldName) => Parser<R, E, I>;
      }
    | { type: "dependent"; on: Array<string>; run: (o: FieldName) => Parser<R, E, I> };

  export type FieldParserResult<D> = D extends FieldParser<infer _, infer R> ? R : never;

  export type OptionalKeys<Fields> = {
    [X in keyof Fields]: Fields[X] extends FieldParser<infer _, infer R> ? (R extends undefined ? X : never) : never;
  }[keyof Fields];

  export type NonOptionalKeys<Fields> = Exclude<keyof Fields, OptionalKeys<Fields>>;

  export type FieldsResult<Fields> = {
    [X in OptionalKeys<Fields>]?: FieldParserResult<Fields[X]>;
  } &
    {
      [X in NonOptionalKeys<Fields>]: FieldParserResult<Fields[X]>;
    };

  export function optional<F extends Field, R, E>(parser: Parser<R, E, object>): FieldParser<F, R | undefined, E> {
    return {
      type: "optional",
      run: field =>
        from(o => {
          if (field in (o as any)) {
            return parser.runParser((o as any)[field]);
          } else {
            return right(undefined);
          }
        })
    };
  }

  export function required<F extends Field, FieldResult>(parser: Parser<FieldResult>): FieldParser<F, FieldResult> {
    return {
      type: "required",
      run: field =>
        from(o => {
          if (field in (o as any)) {
            return parser.runParser((o as any)[field]);
          } else {
            return left(`${JSON.stringify(o)} does not contain field ${JSON.stringify(field)}`);
          }
        })
    };
  }
}

export namespace bigint {
  export const predicate = p("bigint");
}

export namespace undef {}

export namespace object {
  export const predicate = p("object");

  /**
   * Check that object satisfies certain conditions on it's fields.
   * Does not ensure that the object has more fields than listed in `fieldParsers`.
   *
   * @param fieldParsers validators for each field.
   */
  export function has<Fields>(
    fieldParsers: { [X in keyof Fields]: field.FieldParser<X, Fields[X]> }
  ): Parser<field.FieldsResult<{ [X in keyof Fields]: field.FieldParser<X, Fields[X]> }>> {
    return chain(thing.is.object, (obj: object) => {
      // Todo use Validated to improve errors
      const endResult: any = {};
      for (const fieldName in fieldParsers) {
        const parser = fieldParsers[fieldName];
        switch (parser.type) {
          case "dependent":
            break;
          case "optional":
            break;
          case "required":
            break;
        }
        const result = fieldParsers[fieldName].run(fieldName).runParser(obj);
        if (isFailure(result)) {
          return fail(result.left);
        }
        endResult[fieldName] = result.right;
      }
      return succeed(endResult as field.FieldsResult<{ [X in keyof Fields]: field.FieldParser<X, Fields[X]> }>);
    });
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
   * const rgbColorParser: Parser<RGBColor> = object.just({
   *   r: field.required(number.range.inclusive(0, 255)),
   *   g: field.required(number.range.inclusive(0, 255)),
   *   b: field.required(number.range.inclusive(0, 255))
   * });
   * ```
   */
  export function just<Fields>(
    fieldParsers: { [X in keyof Fields]: field.FieldParser<X, Fields[X]> }
  ): Parser<field.FieldsResult<{ [X in keyof Fields]: field.FieldParser<X, Fields[X]> }>> {
    return from(o =>
      E.chain((all: field.FieldsResult<{ [X in keyof Fields]: field.FieldParser<X, Fields[X]> }>) => {
        const thisKeys = new Set(Object.keys(o as any));
        const parserKeys = new Set(Object.keys(fieldParsers));
        const diff = difference(eqString)(thisKeys, parserKeys);
        if (!Array.from(diff).every(x => x in fieldParsers)) {
          return left(
            `${JSON.stringify(all)} has extra fields not present in ${JSON.stringify(
              Object.keys(fieldParsers)
            )}: ${JSON.stringify(diff)}`
          );
        }
        return right(all as any);
      })(has(fieldParsers).runParser(o))
    );
  }
}

export namespace func {
  export const predicate = p("function");
}

export namespace symbol {
  export const predicate = p("symbol");
}

export namespace string {
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

export namespace number {
  export const predicate = p("number");

  export namespace range {
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

export namespace array {
  /**
   * Check that the input value is an array satisfying constraints.
   *
   * @param parser Check for each element of the input array.
   */
  export function of<Value, Input>(parser: Parser<Value>): Parser<Array<Value>, string, Input> {
    return from(o => {
      if (Array.isArray(o)) {
        const results = o.map(each => parser.runParser(each)).filter(isFailure);
        if (results.length > 0) {
          return left(`${JSON.stringify(o)} is an invalid array: ${results.map(x => x.left).join(", ")}`);
        } else {
          return right(o);
        }
      } else {
        return left(`${JSON.stringify(o)} is not an array`);
      }
    });
  }
}
