import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownMessage } from "./markdown-message";

describe("MarkdownMessage", () => {
  it("renders headings, emphasis, ordered and unordered lists, code, and safe links", () => {
    const markup = renderToStaticMarkup(
      <MarkdownMessage
        content={
          "# Skills\n**TypeScript** and `React`\n- Frontend\n- Backend\n1. First\n2. Second\n```ts\nconst ready = true;\n```\n[Docs](https://example.com/docs)"
        }
      />,
    );

    expect(markup).toContain("<h1");
    expect(markup).toContain("<strong>TypeScript</strong>");
    expect(markup).toContain(">React</code>");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<ol");
    expect(markup).toContain("<pre");
    expect(markup).toContain('href="https://example.com/docs"');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it("does not turn unsafe protocols into links", () => {
    const markup = renderToStaticMarkup(
      <MarkdownMessage content="[unsafe](javascript:alert(1))" />,
    );

    expect(markup).not.toContain("<a");
    expect(markup).toContain("[unsafe](javascript:alert(1))");
  });
});
