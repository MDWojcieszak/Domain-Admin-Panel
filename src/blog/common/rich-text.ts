import { BadRequestException } from '@nestjs/common';

/**
 * Notion-style inline color palette. Tokens are used in the Markdown color
 * directive (`:color[text]{fg=red bg=yellow}`) and rendered to theme CSS vars by
 * the reader — they are NOT stored as a DB column. This list is the contract:
 * the FE picker and the server-side validator both use it.
 */
export const BLOG_COLORS = [
  'default',
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const;

export type BlogColorToken = (typeof BLOG_COLORS)[number];

const COLOR_SET = new Set<string>(BLOG_COLORS);

// A real HTML tag: `<`, optional `/`, a letter, then word chars and a closing
// `>`. Requires the `>` so bare inequalities (`a < b`) do not match.
const HTML_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;
const COLOR_DIRECTIVE = /:color\[[^\]]*\]\{([^}]*)\}/g;
const COLOR_ATTR = /\b(?:fg|bg)=([a-zA-Z]+)/g;

/**
 * Enforces "no HTML/CSS in content — only tokens" on user rich text (section
 * title/body, list item content, image caption/alt/overlay). Rejects raw HTML
 * and any color-directive token outside {@link BLOG_COLORS}. Colors live inline
 * in the text; the reader maps the tokens to theme CSS variables.
 */
export function validateRichText(text: string | null | undefined): void {
  if (!text) return;

  if (HTML_TAG.test(text)) {
    throw new BadRequestException(
      'Raw HTML is not allowed in content; use Markdown and color tokens instead.',
    );
  }

  for (const directive of text.matchAll(COLOR_DIRECTIVE)) {
    for (const attr of directive[1].matchAll(COLOR_ATTR)) {
      const token = attr[1].toLowerCase();
      if (!COLOR_SET.has(token)) {
        throw new BadRequestException(
          `Unknown color token "${attr[1]}". Allowed: ${BLOG_COLORS.join(', ')}.`,
        );
      }
    }
  }
}
