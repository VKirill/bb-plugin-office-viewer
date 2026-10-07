// Office Viewer — a small XML reader for Office packages: elements keep their
// prefixes (`a:solidFill`), so lookups use the names printed in the files.

export type Xml = { name: string; attrs: Record<string, string>; kids: Xml[]; text: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const decode = (text: string) =>
  text.includes("&")
    ? text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) =>
        entity[0] === "#" ? String.fromCodePoint(entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)) : (ENTITIES[entity] ?? match),
      )
    : text;

export function parseXml(source: string): Xml {
  const root: Xml = { name: "", attrs: {}, kids: [], text: "" };
  const stack = [root];
  for (const match of source.matchAll(TOKEN)) {
    const top = stack[stack.length - 1];
    if (match[3]) {
      if (match[2]) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const node: Xml = { name: match[3], attrs: {}, kids: [], text: "" };
      for (const attribute of match[4].matchAll(ATTRIBUTE)) node.attrs[attribute[1]] = decode(attribute[2] ?? attribute[3]);
      top.kids.push(node);
      if (!match[5]) stack.push(node);
    } else if (match[1] !== undefined) top.text += match[1];
    else if (match[6] !== undefined) top.text += decode(match[6]);
  }
  return root.kids[0] ?? root;
}

export const kid = (node: Xml | undefined, name: string) => node?.kids.find((child) => child.name === name);
export const kids = (node: Xml | undefined, name: string) => (node ? node.kids.filter((child) => child.name === name) : []);
/** Walks down one named child per step; undefined as soon as a step is missing. */
export const at = (node: Xml | undefined, ...path: string[]) => path.reduce<Xml | undefined>((current, name) => kid(current, name), node);
