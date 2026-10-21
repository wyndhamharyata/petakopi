export interface InlineAsset {
  /** Identifier the generated MDX import binds, e.g. `img_a1b2c3d4`. */
  id: string;
  /** Staging key, repo path suffix and relative import path all at once. */
  r2Key: string;
  /** Already committed by an earlier publish, so staging no longer holds it. */
  committed?: boolean;
}

/** Authored fields only — slug and publish date are derived where they are used. */
export interface ArticleDraft {
  title: string;
  description: string;
  body: string;
  /** Staging key of a hero uploaded in this session. */
  heroKey?: string;
  /** Frontmatter path of an already committed hero, kept verbatim. */
  heroPath?: string;
  /** Chosen but not yet uploaded; IndexedDB can store a File, localStorage cannot. */
  heroFile?: File;
  inlineAssets: InlineAsset[];
  updatedAt: number;
}
