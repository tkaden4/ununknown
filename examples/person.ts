import { recursive, Validator, primitive, array } from "../src";
import { required, just, optional } from "../src/object";

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
