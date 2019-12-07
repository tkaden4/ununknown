import { thing, isSuccess } from "./index";

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

    // is.not.equalTo success
    expect(isSuccess(thing.is.not.equalTo(1)(2))).toBeTruthy();
    expect(isSuccess(thing.is.not.equalTo("foobar")("baz"))).toBeTruthy();
    expect(isSuccess(thing.is.not.equalTo("foobar")(0))).toBeTruthy();
    expect(isSuccess(thing.is.not.equalTo(0)(true))).toBeTruthy();

    // is.not.equalTo failure
    expect(isSuccess(thing.is.not.equalTo("foobar")("foobar"))).toBeFalsy();
    expect(isSuccess(thing.is.not.equalTo(0)(0))).toBeFalsy();
    expect(isSuccess(thing.is.not.equalTo({})({}))).toBeFalsy();
    expect(isSuccess(thing.is.not.equalTo({ age: 0 })({ age: 0 }))).toBeFalsy();
  });
});
