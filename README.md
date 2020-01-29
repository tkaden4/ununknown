<img src="media/logo.png" height=300 width=300 />

# ununknown

[![npm version](https://badge.fury.io/js/ununknown.svg)](https://badge.fury.io/js/ununknown)

Typesafe combinatorial data validators/parsers for typescript using [fp-ts](https://gcanti.github.io/fp-ts/).

Documentation is available [here](https://www.tkaden.net/ununknown).

## Installation

```bash
npm install ununknown
```

## Outline

The crux of the problem this library solves is the following:
How do we ensure that an object of type `unknown` is actually
of type `T` in our typescript project? This problem comes up
in several situations, including, if not limited to:

- REST APIs
- Javascript Interop
- JSON RPCs

## `Functor`, `Applicative`, and `Monad` instances

Instances for `Functor`, `Applicative`, and `Monad` are available so that you can do high-level parsing:

```typescript
// Converts from a string to a number
const numberFromString: Parser<number> = chain(thing.is.string, (s: string) =>
  +s === NaN ? fail(`${s} is not a number`) : succeed(+s)
);

interface Date {
  year: number;
  month: number;
  day: number;
}

// Validator/parser that takes in objects of the following form:
/**
 * {
 *   year: "...",
 *   month: "...",
 *   day: "..."
 * }
 * and gives us back an object of type Date, with fields checked for validity
 * */
const simpleDateValidator: Parser<Date> = object.just({
  year: required(compose(numberFromString, number.range.inclusive(0, 4000))),
  month: required(compose(numberFromString, number.range.inclusive(1, 12))),
  day: required(compose(numberFromString, number.range.inclusive(0, 31)))
});

// Or if we want parsing that is more context-sensitive (correct number of days depending on the month)
const dateValidator: Parser<Date> = chain(
  object.just({
    year: field.required(compose(numberFromString, number.range.inclusive(0, 4000))),
    month: field.required(compose(numberFromString, number.range.inclusive(1, 12))),
    day: field.required(numberFromString)
  }),
  ({ year, month, day }) =>
    correctDaysForMonth(month, day) // definition elided for convenience
      ? succeed({ year, month, day })
      : fail(`${day} is not a valid number of days for month ${month}`)
);
```

## Example

```typescript
import { recursive, Parser, object, field, thing, array, runParser, runParserEx, isSuccess } from "ununknown";

interface Person {
  name: {
    first: string;
    last: string;
  };
  age?: number;
  children: Array<Person>;
}

const personValidator: Parser<Person> = recursive(() =>
  object.just({
    name: field.required(
      object.just({
        first: field.required(thing.is.string),
        last: field.required(thing.is.string)
      })
    ),
    age: field.optional(thing.is.number),
    children: field.required(array.of(personValidator))
  })
);

// Check if validation succeeded

const test: any = {
  name: {
    first: "Kaden",
    last: "Thomas"
  },
  age: 20,
  children: []
};

// Throws an error with result.left if it fails
const result: Person = runParserEx(personValidator, test);

// Non-exception based
const parseResult = runParser(personValidator, test);
if (isSuccess(parseResult)) {
  const o: Person = parseResult.right;
  console.log("succeeded");
} else {
  console.log("failed with error: ", parseResult.left);
}
```

## Caveats

- Circular references are _not_ handled, which should not affect anything encoded in JSON. However, this is a valid validation case and will be handled in the future.
