import { sequenceT, sequenceS } from "fp-ts/lib/Apply";
import * as E from "fp-ts/lib/Either";
import { Either, isLeft, isRight, left, Left, right, Right } from "fp-ts/lib/Either";
import _ from "lodash";
import { PrimitiveString, TypeNameToPrimitive } from "./util";
import { Lazy } from "fp-ts/lib/function";

export type ParseResult<Error, R> = Either<Error, R>;
export type Parser<R, E, O = unknown> = { runParser: (o: O) => ParseResult<E, R> };
export type ParserReturnType<P> = P extends Parser<infer R, infer _, infer _> ? R : never;

export const from = <R, E, O>(parser: (o: O) => ParseResult<E, R>): Parser<R, E, O> => ({ runParser: parser });
export const fromResult = <R, E, I>(e: Either<E, R>): Parser<R, E, I> => from(_ => e);

export function succeed<R, E, B>(result: R): Parser<R, never, B> {
  return of(result);
}

export function fail<R, E, B>(error: E): Parser<never, E, B> {
  return from(_ => left(error));
}

export function isSuccess<R, E>(result: ParseResult<E, R>): result is Right<R> {
  return isRight(result);
}

export function isFailure<R, E>(result: ParseResult<E, R>): result is Left<E> {
  return isLeft(result);
}

export const URI = "Parser" as const;
export type URI = typeof URI;

declare module "fp-ts/lib/HKT" {
  interface URItoKind3<R, E, A> {
    Parser: Parser<A, E, R>;
  }
}

export const mapError = <A, E, R, D>(parser: Parser<A, E, R>, ed: (e: E) => D): Parser<A, D, R> => {
  return from(o => {
    const result = parser.runParser(o);
    return E.either.mapLeft(result, ed);
  });
};

const parserFunctor = {
  URI,
  map: <A, E, B, C>(v: Parser<A, E, C>, f: (a: A) => B): Parser<B, E, C> => from((o: C) => E.map(f)(v.runParser(o)))
} as const;

const parserApplicative = {
  ...parserFunctor,
  of: <A, E, C>(a: A): Parser<A, E, C> => from((_: C) => right(a)),
  ap: <A, B, E, C>(fab: Parser<(a: A) => B, E, C>, a: Parser<A, E, C>): Parser<B, E, C> =>
    from((o: C) => E.ap(a.runParser(o))(fab.runParser(o)))
} as const;

const parserMonad = {
  ...parserApplicative,
  chain: <A, B, E, C>(fa: Parser<A, E, C>, afb: (a: A) => Parser<B, E, C>): Parser<B, E, C> =>
    from((o: C) => E.chain((a: A): Either<E, B> => afb(a).runParser(o))(fa.runParser(o)))
} as const;

export const parser = {
  ...parserMonad,
  mapError
} as const;

export const map = parserMonad.map;
export const of = parserMonad.of;
export const ap = parserMonad.ap;
export const chain = parserMonad.chain;

export const compose = <A, B, C, E, D>(vb: Parser<B, E, A>, vc: Parser<C, D, B>): Parser<C, E | D, A> => {
  return chain(vb, (b: B): Parser<C, E | D, A> => from((_: A) => vc.runParser(b)));
};

/**
 * Due to javascript not being a "lazy" language, we have to embed recursive references to
 * parsers in a thunk.
 *
 * @param body A thunk that returns a parser, possibly one that references itself.
 */
export function recursive<R, E, I>(body: Lazy<Parser<R, E, I>>): Parser<R, E, I> {
  return from(o => body().runParser(o));
}

/**
 * Run two parsers, failing if either fail and succeeding when both succeed.
 */
export function both<A, B, E, I>(fst: Parser<A, E, I>, snd: Parser<B, E, I>): Parser<[A, B], E, I> {
  return ap(
    map(fst, (t: A) => (u: B) => [t, u]),
    snd
  );
}

/**
 * Run two parsers on an unknown, succeeding if either succeed and failing if both fail.
 */
export function or<A, B, I>(fst: Parser<A, string, I>, snd: Parser<B, string, I>): Parser<A | B, string, I> {
  return from(o => {
    const fres = fst.runParser(o);
    const sres = snd.runParser(o);
    return isSuccess(fres) ? fres : isSuccess(sres) ? sres : left(`${fres.left} and ${sres.left}`);
  });
}

/**
 * Given an object of type B, parse out an object of type R with the possibility of errors of type E
 */
export function runParser<R, E, I>(parser: Parser<R, E, I>, input: I) {
  return parser.runParser(input);
}

/**
 * Given an anonymous object and a parser, return the object or throw an exception if parsing fails.
 *
 * @param input value to parse from
 * @param parser the parser to run
 */
export function runParserEx<Result, Error, Input>(parser: Parser<Result, Error, Input>, input: Input): Result | never {
  const result = parser.runParser(input);
  if (isFailure(result)) {
    throw new Error(`${result.left}`);
  }
  return result.right;
}

export type PredicateMismatchError = { _tag: "PredicateMismatch"; value: unknown; customMessage: string };

export const predicate = <K extends PrimitiveString, I>(type: K) => (
  p: (s: TypeNameToPrimitive<K>) => boolean,
  template: (s: TypeNameToPrimitive<K>) => string = s => `${s} did not satisfy custom constraint`
): Parser<TypeNameToPrimitive<K>, thing.is.TypeMismatchError | PredicateMismatchError, I> =>
  from(o =>
    E.chain(
      (
        s: TypeNameToPrimitive<K>
      ): Either<thing.is.TypeMismatchError | PredicateMismatchError, TypeNameToPrimitive<K>> =>
        p(s) ? right(s) : left({ _tag: "PredicateMismatch", value: o, customMessage: template(s) })
    )(thing.is.of(type).runParser(o))
  );

export namespace thing {
  export namespace is {
    export type TypeMismatchError = { _tag: "NotOfType"; type: PrimitiveString; value: unknown };

    /**
     * Ensure that the input value is one the many primitive javascript objects.
     * @param type string representing the `typeof` string for the object.
     */
    export function of<K extends PrimitiveString, I>(type: K): Parser<TypeNameToPrimitive<K>, TypeMismatchError, I> {
      return from(o => {
        if (typeof o === type) {
          return right((o as unknown) as TypeNameToPrimitive<K>);
        } else {
          return left({ _tag: "NotOfType", type, value: o });
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
  ) as Parser<true, PredicateMismatchError | thing.is.TypeMismatchError>;

  export const isFalse = predicate("boolean")(
    s => !s,
    () => `expected false, got true`
  ) as Parser<false, PredicateMismatchError | thing.is.TypeMismatchError>;
}

export namespace field {
  export type Field = string | number | symbol;

  export type FieldParserError = { _tag: "FieldDoesNotExistOn"; on: unknown; field: Field };

  export function optional<R, E>(
    field: string | number,
    parser: Parser<R, E, unknown>
  ): Parser<R | undefined, E, unknown> {
    return from(o => {
      if (field in (o as any)) {
        return parser.runParser((o as any)[field]);
      } else {
        return right(undefined);
      }
    });
  }

  export function required<R, E>(
    field: string | number,
    parser: Parser<R, E>
  ): Parser<R, E | FieldParserError | thing.is.TypeMismatchError, unknown> {
    return chain(
      thing.is.object,
      (o: object): Parser<R, E | FieldParserError | thing.is.TypeMismatchError> => {
        if (field in (o as any)) {
          return fromResult(parser.runParser((o as any)[field]));
        } else {
          return fail({ _tag: "FieldDoesNotExistOn", on: o, field });
        }
      }
    );
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
   * Does not ensure that the object has more fields than listed.
   */
  export const of = sequenceS(parser);
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
  export type ArrayParserError<A, I> =
    | { _tag: "NotAnArray"; input: I }
    | { _tag: "ElementMisMatch"; array: Array<A>; element: A };
  /**
   * Check that the input value is an array satisfying constraints.
   *
   * @param parser Check for each element of the input array.
   */
  export function of<Value, Error, Input>(
    parser: Parser<Value, Error>
  ): Parser<Array<Value>, Error | ArrayParserError<unknown, Input>, Input> {
    return from(o => {
      if (Array.isArray(o)) {
        const results = o.map(each => parser.runParser(each)).filter(isFailure);
        if (results.length > 0) {
          return left({ _tag: "ElementMisMatch", array: o, element: results[0] });
        } else {
          return right(o);
        }
      } else {
        return left({ _tag: "NotAnArray", input: o });
      }
    });
  }
}
