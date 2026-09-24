import { Marked } from "marked";

const marked = new Marked({ gfm: true, breaks: false });

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  // Envuelve las tablas para que hagan scroll horizontal en móvil.
  return html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
}
