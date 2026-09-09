import { describe, expect, it } from "vitest";
import { buildCsv } from "@common/csv/buildCsv";

describe("buildCsv", () => {
  it("quotes every cell and escapes embedded quotes/commas", () => {
    const csv = buildCsv(
      ["Name", "Note"],
      [["Alice", 'Said "hi", then left'], ["Bob", null]],
    );
    expect(csv).toBe('"Name","Note"\r\n"Alice","Said ""hi"", then left"\r\n"Bob",""\r\n');
  });

  it("returns a header-only CSV for an empty row set", () => {
    expect(buildCsv(["A", "B"], [])).toBe('"A","B"\r\n');
  });
});
