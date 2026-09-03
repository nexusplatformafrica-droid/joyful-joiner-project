import { SVG_ICONS } from "@/components/icons/set";

/** Flat two-tone SVG icon set — keys match category slugs. */
export function Icon3D({
  name,
  className = "size-5",
  alt = "",
}: {
  name: string;
  className?: string;
  alt?: string;
}) {
  const node = SVG_ICONS[name] ?? SVG_ICONS["home"];
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`${className} inline-flex shrink-0 items-center justify-center [&>svg]:size-full [&>svg]:drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]`}
    >
      {node}
    </span>
  );
}

