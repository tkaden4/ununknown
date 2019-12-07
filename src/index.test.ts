import { primitive, Validator, recursive, array, object } from "./index";
import { isRight } from "fp-ts/lib/Either";

describe("primitive validation", () => {
  test("string", () => {
    expect(isRight(primitive("string")("test string"))).toBeTruthy();
    expect(isRight(primitive("string")(0))).toBeFalsy();
    expect(isRight(primitive("string")({}))).toBeFalsy();
    expect(isRight(primitive("string")({ a: 0 }))).toBeFalsy();
    expect(isRight(primitive("string")(null))).toBeFalsy();
    expect(isRight(primitive("string")(undefined))).toBeFalsy();
  });
});
