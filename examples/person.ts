import { recursive, DataValidator, primitive, array } from "../src";
import { required, only, optional } from "../src/object";

interface Person {
  name: {
    first: string;
    last: string;
  };
  age?: number;
  children: Array<Person>;
}

const personValidator: DataValidator<Person> = recursive(() =>
  only({
    name: required(
      only({
        first: required(primitive("string")),
        last: required(primitive("string"))
      })
    ),
    age: optional(primitive("number")),
    children: required(array(personValidator))
  })
);
