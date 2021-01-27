<img src="media/logo.png" height=300 width=300 />

# ununknown

[![npm version](https://badge.fury.io/js/ununknown.svg)](https://badge.fury.io/js/ununknown)

Typesafe combinatorial data validators/parsers for typescript using [fp-ts](https://gcanti.github.io/fp-ts/).

Documentation is available [here](https://tkaden4.github.io/ununknown).

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

## Example

```typescript
import { array, field, isSuccess, object, Parser, recursive, runParser, runParserEx, thing } from "ununknown";

interface Person {
  name: {
    first: string;
    last: string;
  };
  age?: number;
  children: Array<Person>;
}

const personValidator: Parser<Person, unknown> = recursive(() =>
  object.of({
    name: field.required(
      "name",
      object.of({
        first: field.required("first", thing.is.string),
        last: field.required("last", thing.is.string)
      })
    ),
    age: field.optional("age", thing.is.number),
    children: field.required("children", array.of(personValidator))
  })
);

// Check if validation succeeded

const test = {
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
