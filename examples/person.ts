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
