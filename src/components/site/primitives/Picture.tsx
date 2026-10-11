import type { SiteImage } from "@/lib/images";
import { withBase } from "@/lib/basePath";

type Props = {
  img: SiteImage;
  /** Rendered width hint, e.g. "(min-width: 1024px) 33vw, 100vw". */
  sizes: string;
  /** Above-the-fold image: eager + high fetch priority. */
  priority?: boolean;
  className?: string;
};

/** Responsive <img> for manifest photos (static export, images are pre-sized: 640w / 1280w). */
export function Picture({ img, sizes, priority = false, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export with pre-generated sizes
    <img
      src={withBase(img.src640)}
      srcSet={`${withBase(img.src640)} 640w, ${withBase(img.src1280)} 1280w`}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={img.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}
