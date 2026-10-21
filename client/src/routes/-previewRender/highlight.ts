import { tryCatch } from "@maxmorozoff/try-catch-tuple";
import type { HighlighterCore } from "shiki/core";

// shiki/core, not the full bundle whose index makes Vite emit a chunk per grammar.
const LANGUAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  css: () => import("shiki/langs/css.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  shellscript: () => import("shiki/langs/shellscript.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
};

const ALIASES: Record<string, string> = {
  bash: "shellscript",
  sh: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  js: "javascript",
  ts: "typescript",
  md: "markdown",
};

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Set<string>();

function getHighlighter(): Promise<HighlighterCore> {
  // The JavaScript engine avoids shipping the Oniguruma WASM binary.
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, theme] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("shiki/themes/github-dark.mjs"),
    ]);

    return createHighlighterCore({
      themes: [theme.default],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  })();

  return highlighterPromise;
}

/** Null for anything without a grammar — `dirtree` and `templ` both appear in posts. */
export async function highlightCode(
  code: string,
  lang: string | undefined
): Promise<string | null> {
  if (!lang) return null;

  const key = lang.trim().toLowerCase();
  const resolved = ALIASES[key] ?? key;
  if (!(resolved in LANGUAGE_LOADERS)) return null;

  const [html] = await tryCatch(async () => {
    const highlighter = await getHighlighter();

    if (!loadedLanguages.has(resolved)) {
      const grammar = (await LANGUAGE_LOADERS[resolved]()) as { default: unknown };
      await highlighter.loadLanguage(grammar.default as never);
      loadedLanguages.add(resolved);
    }

    // github-dark is Astro's default, so the preview matches the published page.
    return highlighter.codeToHtml(code, { lang: resolved, theme: "github-dark" });
  });
  return html;
}
