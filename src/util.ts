export type Primitive = string | object | number | undefined | bigint | Function | symbol | boolean;

export type PrimitiveString =
  | "string"
  | "object"
  | "number"
  | "undefined"
  | "bigint"
  | "function"
  | "symbol"
  | "boolean";

export type PrimitiveTypeString<C extends Primitive> = C extends string
  ? "string"
  : C extends object
  ? "object"
  : C extends number
  ? "number"
  : C extends undefined
  ? "undefined"
  : C extends bigint
  ? "bigint"
  : C extends Function
  ? "function"
  : C extends symbol
  ? "symbol"
  : C extends boolean
  ? "boolean"
  : never;

export type TypeNameToPrimitive<C extends string> = C extends "string"
  ? string
  : C extends "object"
  ? object
  : C extends "number"
  ? number
  : C extends "undefined"
  ? undefined
  : C extends "bigint"
  ? bigint
  : C extends "function"
  ? Function
  : C extends "symbol"
  ? symbol
  : C extends "boolean"
  ? boolean
  : never;
