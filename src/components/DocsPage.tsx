import { ExternalLink, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import projectSubmission from "../../docs/project-submission.md?raw";
import whitepaper from "../../docs/whitepaper.md?raw";
import { MarkdownDoc, slugifyHeading } from "./MarkdownDoc";

type DocKey = "whitepaper" | "submission";

const documents: Record<DocKey, { title: string; label: string; description: string; content: string }> = {
  whitepaper: {
    title: "LumenFi whitepaper",
    label: "Whitepaper",
    description: "Product scope, deployed architecture, market design, risks, and release boundaries.",
    content: whitepaper
  },
  submission: {
    title: "Project submission",
    label: "Submission brief",
    description: "A concise review pack for the live Arc Testnet build and its verifiable components.",
    content: projectSubmission
  }
};

function headingsFromMarkdown(content: string) {
  return content
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

export function DocsPage() {
  const [activeDoc, setActiveDoc] = useState<DocKey>("whitepaper");
  const document = documents[activeDoc];
  const headings = useMemo(() => headingsFromMarkdown(document.content), [document.content]);

  return (
    <section className="docsPage" aria-labelledby="docs-title">
      <header className="docsHero">
        <div>
          <p className="eyebrow">Documentation</p>
          <h1 id="docs-title">{document.title}</h1>
          <p>{document.description}</p>
        </div>
        <a href="https://github.com/Tiger1102/lumenfi" target="_blank" rel="noreferrer">
          View source <ExternalLink size={15} />
        </a>
      </header>

      <div className="docsLayout">
        <aside className="docsSidebar">
          <div className="docsSwitch" aria-label="LumenFi documents">
            <p>Documents</p>
            {(Object.keys(documents) as DocKey[]).map((key) => (
              <button className={activeDoc === key ? "active" : ""} type="button" aria-pressed={activeDoc === key} onClick={() => setActiveDoc(key)} key={key}>
                <FileText size={16} />
                <span>{documents[key].label}</span>
              </button>
            ))}
          </div>

          <nav className="docsToc" aria-label="On this page">
            <p>On this page</p>
            {headings.map((heading) => <a href={`#${slugifyHeading(heading)}`} key={heading}>{heading}</a>)}
          </nav>
        </aside>

        <article className="docsArticle">
          <div className="docsMeta">
            <span>Version 0.5</span>
            <span>Updated August 2026</span>
            <span>Arc Testnet</span>
          </div>
          <MarkdownDoc content={document.content} skipFirstHeading />
        </article>
      </div>
    </section>
  );
}
