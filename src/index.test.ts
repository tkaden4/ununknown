import {
  thing,
  recursive,
  object,
  field,
  array,
  number,
  isSuccess,
  chain,
  succeed,
  fail,
  compose,
  runParser,
  parser,
  Parser,
  isFailure
} from "./index";
import { sequenceS } from "fp-ts/lib/Apply";

describe("primitive validation", () => {
  test("string", () => {
    expect(isSuccess(thing.is.string.runParser("test string"))).toBeTruthy();
    expect(isSuccess(thing.is.string.runParser(0))).toBeFalsy();
    expect(isSuccess(thing.is.string.runParser({}))).toBeFalsy();
    expect(isSuccess(thing.is.string.runParser({ a: 0 }))).toBeFalsy();
    expect(isSuccess(thing.is.string.runParser(null))).toBeFalsy();
    expect(isSuccess(thing.is.string.runParser(undefined))).toBeFalsy();
  });

  test("equality", () => {
    // is.equalTo success
    expect(isSuccess(thing.is.equalTo("foobar").runParser("foobar"))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(0).runParser(0))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo({}).runParser({}))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(true).runParser(true))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(false).runParser(false))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(undefined).runParser(undefined))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo(null).runParser(null))).toBeTruthy();
    expect(isSuccess(thing.is.equalTo({ age: 0 }).runParser({ age: 0 }))).toBeTruthy();

    // is.equalTo failure
    expect(isSuccess(thing.is.equalTo(0).runParser(1))).toBeFalsy();
    expect(isSuccess(thing.is.equalTo(1).runParser("foobar"))).toBeFalsy();

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
});

describe("structured validation", () => {
  interface RGBColor {
    r: number;
    g: number;
    b: number;
  }

  const rgbColorValidator = sequenceS(parser)({
    r: field.required("r", number.range.inclusive(0, 255)),
    g: field.required("g", number.range.inclusive(0, 255)),
    b: field.required("b", number.range.inclusive(0, 255))
  });

  const hasField = object.of({ hello: field.required("hello", thing.is.string) });

  test("null edge case", () => {
    expect(isFailure(hasField.runParser(null))).toBeTruthy();
  });

  test("rgb color", () => {
    // Valid
    expect(isSuccess(rgbColorValidator.runParser({ r: 0, g: 0, b: 0 }))).toBeTruthy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 255, g: 0, b: 0 }))).toBeTruthy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 0, g: 255, b: 0 }))).toBeTruthy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 0, g: 0, b: 255 }))).toBeTruthy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 255, g: 255, b: 255 }))).toBeTruthy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 12, g: 244, b: 250 }))).toBeTruthy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 96, g: 84, b: 114 }))).toBeTruthy();

    // Not valid
    expect(isSuccess(rgbColorValidator.runParser({ r: -1, g: 0, b: 0 }))).toBeFalsy();
    expect(isSuccess(rgbColorValidator.runParser({ r: -1, g: -1, b: 0 }))).toBeFalsy();
    expect(isSuccess(rgbColorValidator.runParser({ r: -1, g: -1, b: -1 }))).toBeFalsy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 0, g: -1, b: -1 }))).toBeFalsy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 0, g: 0, b: -1 }))).toBeFalsy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 0, g: 0 }))).toBeFalsy();
    expect(isSuccess(rgbColorValidator.runParser({ r: 30000, g: 256, b: 256 }))).toBeFalsy();
  });

  // test("no extra fields", () => {
  //   const a = {
  //     foobar: 0,
  //     singus: ""
  //   };
  //   const aParser = sequenceS(parser)({
  //     foobar: field.required("foobar", thing.is.number)
  //   });
  //   expect(isSuccess(runParser(aParser, a))).toBeFalsy();
  // });

  test("trie", () => {
    interface Trie {
      value: string;
      children: Array<Trie>;
    }

    const trieValidator: Parser<Trie, unknown> = recursive(() =>
      sequenceS(parser)({
        value: field.required("value", thing.is.string),
        children: field.required("children", array.of(trieValidator))
      })
    );
    const top: Trie = {
      value: "top",
      children: []
    };

    const topper: Trie = {
      value: "topper",
      children: [top, top, top]
    };

    expect(isSuccess(trieValidator.runParser(top))).toBeTruthy();
    expect(isSuccess(trieValidator.runParser(topper))).toBeTruthy();
    expect(isSuccess(trieValidator.runParser({}))).toBeFalsy();
    expect(isSuccess(trieValidator.runParser({ value: "fake" }))).toBeFalsy();
    expect(isSuccess(trieValidator.runParser({ value: "fake", children: 0 }))).toBeFalsy();
    expect(isSuccess(trieValidator.runParser({ value: "fake", children: [0] }))).toBeFalsy();
  });
  // Converts from a string to a number
  const numberFromString = chain(thing.is.string, (s: string) =>
    +s === NaN ? fail(`${s} is not a number` as string | thing.is.TypeMismatchError) : succeed(+s)
  );

  interface Date {
    year: number;
    month: number;
    day: number;
  }

  const correctDaysForMonth = (month: number, days: number): boolean => {
    return (
      days >= 0 &&
      days <=
        ({
          1: 31,
          2: 28,
          3: 31,
          4: 30,
          5: 31,
          6: 30,
          7: 31,
          8: 31,
          9: 30,
          10: 31,
          11: 30,
          12: 31
        } as any)[month]
    );
  };

  test("simple date validation", () => {
    const dateValidatorSimple = object.of({
      year: field.required("year", compose(numberFromString, number.range.inclusive(0, 4000))),
      month: field.required("month", compose(numberFromString, number.range.inclusive(1, 12))),
      day: field.required("day", compose(numberFromString, number.range.inclusive(0, 31)))
    });

    // Correct dates
    expect(isSuccess(dateValidatorSimple.runParser({ year: "0", month: "12", day: "30" }))).toBeTruthy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "1", month: "10", day: "31" }))).toBeTruthy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "0", month: "12", day: "20" }))).toBeTruthy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "1999", month: "1", day: "0" }))).toBeTruthy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "3999", month: "12", day: "30" }))).toBeTruthy();

    // Incorrect dates
    expect(isSuccess(dateValidatorSimple.runParser({ year: "0", day: "30" }))).toBeFalsy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "1", month: "10", day: "32" }))).toBeFalsy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "0", month: "-12", day: "20" }))).toBeFalsy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "1999", month: "1", day: 0 }))).toBeFalsy();
    expect(isSuccess(dateValidatorSimple.runParser({ year: "-3999", month: {}, day: 30 }))).toBeFalsy();
  });

  test("contextual date validation", () => {
    // Or if we want parsing that is more context-sensitive (correct number of days depending on the month)
    const dateParser = chain(
      object.of({
        year: field.required("year", compose(numberFromString, number.range.inclusive(0, 4000))),
        month: field.required("month", compose(numberFromString, number.range.inclusive(1, 12))),
        day: field.required("day", numberFromString)
      }),
      ({ year, month, day }) =>
        correctDaysForMonth(month, day)
          ? succeed({ year, month, day })
          : fail(`${day} is not a valid number of days for month ${month}`)
    );
    // Correct dates
    expect(isSuccess(dateParser.runParser({ year: "0", month: "12", day: "30" }))).toBeTruthy();
    expect(isSuccess(dateParser.runParser({ year: "1", month: "10", day: "31" }))).toBeTruthy();
    expect(isSuccess(dateParser.runParser({ year: "0", month: "12", day: "20" }))).toBeTruthy();
    expect(isSuccess(dateParser.runParser({ year: "1999", month: "1", day: "0" }))).toBeTruthy();
    expect(isSuccess(dateParser.runParser({ year: "3999", month: "12", day: "30" }))).toBeTruthy();

    // Incorrect dates
    expect(isSuccess(dateParser.runParser({ year: "0", day: "30" }))).toBeFalsy();
    expect(isSuccess(dateParser.runParser({ year: "1", month: "10", day: "32" }))).toBeFalsy();
    expect(isSuccess(dateParser.runParser({ year: "0", month: "-12", day: "20" }))).toBeFalsy();
    expect(isSuccess(dateParser.runParser({ year: "1999", month: "1", day: 0 }))).toBeFalsy();
    expect(isSuccess(dateParser.runParser({ year: "-3999", month: {}, day: 30 }))).toBeFalsy();
  });
});
