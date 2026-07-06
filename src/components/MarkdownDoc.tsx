import type { ReactNode } from "react";

type MarkdownDocProps = {
  content: string;
};

function inlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    return part;
  });
}

export function MarkdownDoc({ content }: MarkdownDocProps) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").split("\n");
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  function flushLists() {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {listItems.map((item) => <li key={item}>{inlineCode(item)}</li>)}
        </ul>
      );
      listItems = [];
    }

    if (orderedItems.length > 0) {
      blocks.push(
        <ol key={`ol-${blocks.length}`}>
          {orderedItems.map((item) => <li key={item}>{inlineCode(item)}</li>)}
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
      blocks.push(<h1 key={`h1-${blocks.length}`}>{line.slice(2)}</h1>);
      return;
    }

    if (line.startsWith("## ")) {
      flushLists();
      blocks.push(<h2 key={`h2-${blocks.length}`}>{line.slice(3)}</h2>);
      return;
    }

    if (line.startsWith("### ")) {
      flushLists();
      blocks.push(<h3 key={`h3-${blocks.length}`}>{line.slice(4)}</h3>);
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
    blocks.push(<p key={`p-${blocks.length}`}>{inlineCode(line)}</p>);
  });

  flushLists();

  return <div className="docBody">{blocks}</div>;
}
