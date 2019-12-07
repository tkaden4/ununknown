# ts-data

Typesafe combinatorial data validators for typescript using [fp-ts](https://gcanti.github.io/fp-ts/).

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
import { Validator, primitive, array, recursive } from "ts-data";
import { required, optional, just } from "ts-data/object";

interface Person {
  name: {
    first: string;
    last: string;
  };
  age?: number;
  children: Array<Person>;
}

const personValidator: Validator<Person> = recursive(() =>
  just({
    name: required(
      just({
        first: required(primitive("string")),
        last: required(primitive("string"))
      })
    ),
    age: optional(primitive("number")),
    children: required(array(personValidator))
  })
);
```
