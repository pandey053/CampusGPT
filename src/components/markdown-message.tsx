import type { ReactNode } from "react";

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string; level: number }
  | { kind: "list"; items: string[]; ordered: boolean }
  | { kind: "code"; text: string };

export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: Block[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    const listItem = line.match(/^\s*(?:(-|\*|\+)\s+|(\d+)[.)]\s+)(.+)$/);
    if (listItem) {
      const ordered = Boolean(listItem[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(
          /^\s*(?:(-|\*|\+)\s+|(\d+)[.)]\s+)(.+)$/,
        );
        if (!item || Boolean(item[2]) !== ordered) break;
        items.push(item[3]);
        index += 1;
      }
      blocks.push({ kind: "list", items, ordered });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s{0,3}#{1,6}\s+/.test(lines[index]) &&
      !/^\s*(?:(-|\*|\+)\s+|(\d+)[.)]\s+)/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }

  return (
    <div className="markdown-message min-w-0 space-y-3 break-words">
      {blocks.map((block, index) => {
        if (block.kind === "code") {
          return (
            <pre
              className="overflow-x-auto rounded-xl bg-[#202b24] p-4 text-xs leading-5 text-[#e5eee7]"
              key={index}
            >
              <code>{block.text}</code>
            </pre>
          );
        }
        if (block.kind === "heading") {
          const Heading = `h${Math.min(block.level, 4)}` as "h1" | "h2" | "h3" | "h4";
          return (
            <Heading className="font-semibold leading-snug" key={index}>
              <InlineMarkdown text={block.text} />
            </Heading>
          );
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              className={`space-y-1.5 pl-6 ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
              key={index}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p className="whitespace-pre-wrap" key={index}>
            <InlineMarkdown text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const tokenPattern =
    /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s]+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));

    if (value.startsWith("**") && value.endsWith("**")) {
      parts.push(<strong key={index}>{value.slice(2, -2)}</strong>);
    } else if (value.startsWith("`") && value.endsWith("`")) {
      parts.push(
        <code
          className="rounded bg-[#edf0eb] px-1 py-0.5 font-mono text-[0.9em]"
          key={index}
        >
          {value.slice(1, -1)}
        </code>,
      );
    } else if (value.startsWith("*") && value.endsWith("*")) {
      parts.push(<em key={index}>{value.slice(1, -1)}</em>);
    } else {
      const markdownLink = value.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      const href = markdownLink?.[2] ?? value;
      const label = markdownLink?.[1] ?? value;
      parts.push(
        <a
          className="break-all text-[#285c49] underline underline-offset-2 hover:text-[#477963]"
          href={href}
          key={index}
          rel="noopener noreferrer"
          target="_blank"
        >
          {label}
        </a>,
      );
    }
    lastIndex = index + value.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
