import type { Token } from "marked";
import { highlightCode } from "./highlight";
import type { InlineAsset } from "./types";

export function stagedAssetUrl(r2Key: string): string {
  return `/api/admin/assets/object?key=${encodeURIComponent(r2Key)}`;
}

export function repoAssetUrl(key: string): string {
  return `/api/admin/assets/repo?key=${encodeURIComponent(key)}`;
}

// Lazy so the textarea is interactive first; output is unsanitised, being the admin's own draft.
let markedModule: Promise<typeof import("marked")> | null = null;

// Shared by the writer and the reader below, which must agree or highlighting silently drops.
const fenceKey = (lang: string | undefined, text: string) => `${lang ?? ""}|${text}`;

export async function renderPreview(body: string, assets: InlineAsset[]): Promise<string> {
  const { Marked } = await (markedModule ??= import("marked"));

  const withUploads = body.replace(
    /!\[Uploading ([^\]]*)\]\(uploading:[^)]*\)/g,
    (_match, name: string) =>
      `<span class="badge badge-neutral gap-2"><span class="loading loading-spinner loading-xs"></span>Uploading ${escapeHtml(name)}</span>`
  );

  // Mirrors BlogImage.astro's markup so the preview matches the published page.
  const prepared = withUploads.replace(/<BlogImage\s+([^>]*?)\/>/g, (_match, rawAttrs: string) => {
    const attrs: Record<string, string> = {};
    for (const attr of rawAttrs.matchAll(
      /([A-Za-z]+)\s*=\s*(?:"([^"]*)"|\{([A-Za-z_$][\w$]*)\})/g
    )) {
      const [, name, quoted, identifier] = attr;
      // Braces are retained so an identifier is distinguishable from a URL below.
      attrs[name] = quoted !== undefined ? quoted : `{${identifier}}`;
    }

    const rawSrc = attrs.src;
    let src: string | null = rawSrc ?? null;
    if (rawSrc?.startsWith("{")) {
      const asset = assets.find((candidate) => candidate.id === rawSrc.slice(1, -1));
      src = asset
        ? asset.committed
          ? repoAssetUrl(asset.r2Key)
          : stagedAssetUrl(asset.r2Key)
        : null;
    }

    if (!src) {
      return `<div class="alert alert-warning my-6">Image not found: ${escapeHtml(rawSrc ?? "(no src)")}</div>`;
    }

    const caption = attrs.caption
      ? `<figcaption class="text-base-content/70 mt-2 text-center text-sm italic">${escapeHtml(attrs.caption)}</figcaption>`
      : "";

    return `<figure class="my-6"><img src="${escapeHtml(src)}" alt="${escapeHtml(attrs.alt ?? "")}" class="mx-auto max-w-full rounded-lg shadow-md" loading="lazy" />${caption}</figure>`;
  });

  const instance = new Marked({ gfm: true, async: false });

  // Shiki is async and marked's `code` renderer is not, so every fence is
  // highlighted up front. marked's own walker, because list items keep their
  // children under `items`, which a `token.tokens` recursion misses.
  const fences = new Map<string, { lang?: string; text: string }>();
  instance.walkTokens(instance.lexer(prepared), (token: Token) => {
    if (token.type === "code") {
      fences.set(fenceKey(token.lang, token.text), { lang: token.lang, text: token.text });
    }
  });

  const highlighted = new Map<string, string>();
  await Promise.all(
    [...fences].map(async ([key, { lang, text }]) => {
      const html = await highlightCode(text, lang);
      if (html) highlighted.set(key, html);
    })
  );

  instance.use({
    renderer: {
      code({ text, lang }) {
        const className = lang ? ` class="language-${escapeHtml(lang)}"` : "";
        return (
          highlighted.get(fenceKey(lang, text)) ??
          `<pre><code${className}>${escapeHtml(text)}\n</code></pre>`
        );
      },
    },
  });

  return instance.parse(prepared, { async: false }) as string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
