import manifest from "../../public/images/manifest.json";

export type SiteImage = {
  slug: string;
  kind: "hero" | "gallery" | "menu" | "about";
  src640: string;
  src1280: string;
  alt: string;
  width: number;
  height: number;
};

export const siteImages = manifest as SiteImage[];

const bySlug = new Map(siteImages.map((i) => [i.slug, i]));
const bySrc = new Map(siteImages.map((i) => [i.src640, i]));

export function imageBySlug(slug: string): SiteImage {
  const img = bySlug.get(slug);
  if (!img) throw new Error(`Unknown image slug: ${slug}`);
  return img;
}

/** Menu items store the 640w path; this finds the full manifest entry for it. */
export const imageForSrc = (src640: string): SiteImage | undefined => bySrc.get(src640);
