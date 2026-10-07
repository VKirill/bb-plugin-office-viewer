// Office Viewer — chat quotes of text: where it comes from, then the text as a Markdown blockquote.

export function formatBlockquote(input: { path: string; host: string; where?: string; text: string }): string {
  const source = [`\`${input.path}\``, input.where, input.host].filter(Boolean).join(" · ");
  const quoted = input.text
    .trim()
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `> ${line.trimEnd()}` : ">"))
    .join("\n");
  return `${source}\n\n${quoted}`;
}
