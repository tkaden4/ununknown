import { thing, isSuccess, Validator, recursive, object, field, array, number } from "./index";

interface RoseTree {
  value: string;
  children: Array<RoseTree>;
}

const roseTreeValidator: Validator<RoseTree> = recursive(() =>
  object.just({
    value: field.required(thing.is.string),
    children: field.required(array.of(roseTreeValidator))
  })
);

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

const rbgColorValidator: Validator<RGBColor> = object.just({
  r: field.required(number.range.inclusive(0, 255)),
  g: field.required(number.range.inclusive(0, 255)),
  b: field.required(number.range.inclusive(0, 255))
});

describe("primitive validation", () => {
  test("string", () => {
    expect(isSuccess(thing.is.string("test string"))).toBeTruthy();
    expect(isSuccess(thing.is.string(0))).toBeFalsy();
    expect(isSuccess(thing.is.string({}))).toBeFalsy();
    expect(isSuccess(thing.is.string({ a: 0 }))).toBeFalsy();
    expect(isSuccess(thing.is.string(null))).toBeFalsy();
    expect(isSuccess(thing.is.string(undefined))).toBeFalsy();
  });

  test("equality", () => {
    // is.equalTo success
    expect(isSuccess(thing.is.equalTo("foobar")("foobar"))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(0)(0))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo({})({}))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(true)(true))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(false)(false))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(undefined)(undefined))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(null)(null))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo({ age: 0 })({ age: 0 }))).toBeTruthy();

    // is.equalTo failure
    expect(isSuccess(thing.is.equalTo(0)(1))).toBeFalsy();
    expect(isSuccess(thing.is.equalTo(1)("foobar"))).toBeFalsy();

    // // is.not.equalTo success
    // expect(isSuccess(thing.is.not.equalTo(1)(2))).toBeTruthy();
    // expect(isSuccess(thing.is.not.equalTo("foobar")("baz"))).toBeTruthy();
    // expect(isSuccess(thing.is.not.equalTo("foobar")(0))).toBeTruthy();
    // expect(isSuccess(thing.is.not.equalTo(0)(true))).toBeTruthy();

    // // is.not.equalTo failure
    // expect(isSuccess(thing.is.not.equalTo("foobar")("foobar"))).toBeFalsy();
    // expect(isSuccess(thing.is.not.equalTo(0)(0))).toBeFalsy();
    // expect(isSuccess(thing.is.not.equalTo({})({}))).toBeFalsy();
    // expect(isSuccess(thing.is.not.equalTo({ age: 0 })({ age: 0 }))).toBeFalsy();
  });

  test("color", () => {
    // Valid
    expect(isSuccess(rbgColorValidator({ r: 0, g: 0, b: 0 }))).toBeTruthy();
    expect(isSuccess(rbgColorValidator({ r: 255, g: 0, b: 0 }))).toBeTruthy();
    expect(isSuccess(rbgColorValidator({ r: 0, g: 255, b: 0 }))).toBeTruthy();
    expect(isSuccess(rbgColorValidator({ r: 0, g: 0, b: 255 }))).toBeTruthy();
    expect(isSuccess(rbgColorValidator({ r: 255, g: 255, b: 255 }))).toBeTruthy();
    expect(isSuccess(rbgColorValidator({ r: 12, g: 244, b: 250 }))).toBeTruthy();
    expect(isSuccess(rbgColorValidator({ r: 96, g: 84, b: 114 }))).toBeTruthy();

    // Not valid
    expect(isSuccess(rbgColorValidator({ r: -1, g: 0, b: 0 }))).toBeFalsy();
    expect(isSuccess(rbgColorValidator({ r: -1, g: -1, b: 0 }))).toBeFalsy();
    expect(isSuccess(rbgColorValidator({ r: -1, g: -1, b: -1 }))).toBeFalsy();
    expect(isSuccess(rbgColorValidator({ r: 0, g: -1, b: -1 }))).toBeFalsy();
    expect(isSuccess(rbgColorValidator({ r: 0, g: 0, b: -1 }))).toBeFalsy();
    expect(isSuccess(rbgColorValidator({ r: 0, g: 0 }))).toBeFalsy();
    expect(isSuccess(rbgColorValidator({ r: 30000, g: 256, b: 256 }))).toBeFalsy();
  });

  test("recursive", () => {
    const top: RoseTree = {
      value: "top",
      children: []
    };

    const topper: RoseTree = {
      value: "topper",
      children: [top, top, top]
    };

    expect(isSuccess(roseTreeValidator(top))).toBeTruthy();
    expect(isSuccess(roseTreeValidator(topper))).toBeTruthy();

    expect(isSuccess(roseTreeValidator({}))).toBeFalsy();
    expect(isSuccess(roseTreeValidator({ value: "fake" }))).toBeFalsy();
    expect(isSuccess(roseTreeValidator({ value: "fake", children: 0 }))).toBeFalsy();
    expect(isSuccess(roseTreeValidator({ value: "fake", children: [0] }))).toBeFalsy();
  });
});
