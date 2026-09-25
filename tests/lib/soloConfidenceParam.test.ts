import { describe, expect, it } from "vitest";
import { decodeConfidenceParam, encodeConfidenceParam } from "@/lib/soloConfidenceParam";

describe("confidence URL codec", () => {
  it("round trips all mastery levels", () => {
    const levels = { 0: 0, 1: 1, 2: 2, 3: 3 };
    expect(decodeConfidenceParam(encodeConfidenceParam(levels))).toEqual(levels);
  });
  it.each([null, "", "{", "null", "false", "7", '"text"'])("rejects non-object input %s", raw => {
    expect(decodeConfidenceParam(raw)).toBeNull();
  });
  it("ignores nonfinite keys and invalid levels while keeping valid entries", () => {
    expect(decodeConfidenceParam('{"Infinity":1,"NaN":2,"abc":3,"0":"2","1":null,"2":4,"3":-1,"4":1.5,"5":true,"6":2}'))
      .toEqual({ 6: 2 });
  });
  it("retains the existing finite numeric key contract", () => {
    expect(decodeConfidenceParam('{"-1":1,"1.5":2,"":3}')).toEqual({ [-1]: 1, 1.5: 2, 0: 3 });
    expect(decodeConfidenceParam("[0,1,2,3]")).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
    expect(decodeConfidenceParam("{}")).toEqual({});
  });
});
