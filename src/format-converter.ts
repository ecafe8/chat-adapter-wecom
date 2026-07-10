import { BaseFormatConverter, parseMarkdown, stringifyMarkdown, type Root } from "chat";

export class WeComFormatConverter extends BaseFormatConverter {
  toAst(platformText: string): Root { return parseMarkdown(platformText); }
  fromAst(ast: Root): string { return stringifyMarkdown(ast); }
}
