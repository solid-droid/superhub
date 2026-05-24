import { describe, expect, it } from "bun:test";
import { applyMetaQuery } from "../Services/QueryService.js";

describe("QueryService", () => {
  const sample = [
    {
      meta: {
        name: "Button",
        version: "1.0.0",
        slug: "widget>design-system>Atom.button",
        description: "button component"
      }
    },
    {
      meta: {
        name: "Input",
        version: "1.1.0",
        slug: "widget>design-system>Atom.input",
        description: "input component"
      }
    },
    {
      meta: {
        name: "Theme Retro",
        version: "2.0.0",
        slug: "theme>design-system>retro",
        description: "retro theme"
      }
    }
  ];

  it("applies nested filter + sort + pagination", () => {
    const result = applyMetaQuery(sample, {
      page: 0,
      pageSize: 10,
      filter: [
        { operator: "OpenBracket" },
        { field: "slug", operator: "startsWith", value: "widget>design-system>" },
        { operator: "AND" },
        { field: "description", operator: "in", value: "component" },
        { operator: "CloseBracket" },
        { operator: "OR" },
        { field: "name", operator: "equals", value: "Theme Retro" }
      ],
      sort: [
        { field: "name", order: "asc" }
      ]
    });

    expect(result.total).toBe(3);
    expect(result.data[0].meta.name).toBe("Button");
    expect(result.data[1].meta.name).toBe("Input");
    expect(result.data[2].meta.name).toBe("Theme Retro");
  });

  it("throws on malformed filter", () => {
    expect(() =>
      applyMetaQuery(sample, {
        filter: [{ operator: "CloseBracket" }]
      })
    ).toThrow();
  });
});
