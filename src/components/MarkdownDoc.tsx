import type { ReactNode } from "react";

type MarkdownDocProps = {
  content: string;
  skipFirstHeading?: boolean;
};

export function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inlineContent(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (markdownLink) {
      return <a href={markdownLink[2]} target="_blank" rel="noreferrer" key={index}>{markdownLink[1]}</a>;
    }

    if (/^https?:\/\//.test(part)) {
      const trailing = part.match(/[.,;:]$/)?.[0] ?? "";
      const href = trailing ? part.slice(0, -1) : part;
      return <span key={index}><a href={href} target="_blank" rel="noreferrer">{href}</a>{trailing}</span>;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

export function MarkdownDoc({ content, skipFirstHeading = false }: MarkdownDocProps) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").split("\n");
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let firstHeadingSkipped = false;

  function flushLists() {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {listItems.map((item) => <li key={item}>{inlineContent(item)}</li>)}
        </ul>
      );
      listItems = [];
    }

    if (orderedItems.length > 0) {
      blocks.push(
        <ol key={`ol-${blocks.length}`}>
          {orderedItems.map((item) => <li key={item}>{inlineContent(item)}</li>)}
        </ol>
      );
      orderedItems = [];
    }
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushLists();
      return;
    }

    if (line.startsWith("# ")) {
      flushLists();
      if (skipFirstHeading && !firstHeadingSkipped) {
        firstHeadingSkipped = true;
        return;
      }
      const heading = line.slice(2);
      blocks.push(<h1 id={slugifyHeading(heading)} key={`h1-${blocks.length}`}>{heading}</h1>);
      return;
    }

    if (line.startsWith("## ")) {
      flushLists();
      const heading = line.slice(3);
      blocks.push(<h2 id={slugifyHeading(heading)} key={`h2-${blocks.length}`}>{heading}</h2>);
      return;
    }

    if (line.startsWith("### ")) {
      flushLists();
      const heading = line.slice(4);
      blocks.push(<h3 id={slugifyHeading(heading)} key={`h3-${blocks.length}`}>{heading}</h3>);
      return;
    }

    if (line.startsWith("- ")) {
      orderedItems = [];
      listItems.push(line.slice(2));
      return;
    }

    if (/^\d+\.\s/.test(line)) {
      listItems = [];
      orderedItems.push(line.replace(/^\d+\.\s/, ""));
      return;
    }

    flushLists();
    blocks.push(<p key={`p-${blocks.length}`}>{inlineContent(line)}</p>);
  });

  flushLists();

  return <div className="docBody">{blocks}</div>;
}
