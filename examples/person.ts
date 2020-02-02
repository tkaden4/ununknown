import { recursive, Parser, field, thing, array, runParserEx, isSuccess, runParser, parser } from "../src";
import { sequenceS } from "fp-ts/lib/Apply";

interface Person {
  name: {
    first: string;
    last: string;
  };
  age?: number;
  children: Array<Person>;
}

const personValidator: Parser<Person, unknown> = recursive(() =>
  sequenceS(parser)({
    name: field.required(
      "name",
      sequenceS(parser)({
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
