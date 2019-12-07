<img src="media/logo.png" height=300 width=300 />

# ununknown

Typesafe combinatorial data validators for typescript using [fp-ts](https://gcanti.github.io/fp-ts/).

Documentation is available [here](https://www.tkaden.net/ununknown), although `404` errors are currently being resolved.

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
import { recursive, Validator, object, field, thing, array } from "../src";

interface Person {
  name: {
    first: string;
    last: string;
  };
  age?: number;
  children: Array<Person>;
}

const personValidator: Validator<Person> = recursive(() =>
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
```
