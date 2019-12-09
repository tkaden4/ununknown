import { recursive, Parser, object, field, thing, array, runParserEx, isSuccess, runParser } from "../src";

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
const result: Person = runParserEx(test, personValidator);

// Non-exception based
const parseResult = runParser(personValidator, test);
if (isSuccess(parseResult)) {
  const o: Person = parseResult.right;
  console.log("succeeded");
} else {
  console.log("failed with error: ", parseResult.left);
}
