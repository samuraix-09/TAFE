import katex from "katex";
import "katex/dist/katex.min.css";

export function SatNotation({ text }: { text: string }) {
  return text
    .split(/(\$\$[^$]+\$\$|\$[^$\n]+\$|\\\([^\n]+?\\\)|\\\[[\s\S]+?\\\])/g)
    .map((part, index) => {
      if (index % 2 === 0) return part;
      const width = part.startsWith("$$") || part.startsWith("\\") ? 2 : 1;
      const html = katex.renderToString(part.slice(width, -width), {
        throwOnError: false,
        trust: false,
        maxExpand: 100,
        maxSize: 10,
      });
      return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
    });
}
