// Circular initials avatar with a deterministic color per name/id — stands in
// for profile photos (WhatsApp-style).

const COLORS = [
  "#0a7d6b",
  "#5b6abc",
  "#b8734a",
  "#7a5bbc",
  "#357a8c",
  "#a15b7a",
  "#4a7a3a",
  "#8c6b35",
];

function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  seed,
  size = 40,
  group = false,
}: {
  name: string;
  seed?: string;
  size?: number;
  group?: boolean;
}) {
  const bg = group ? "#6a7175" : colorFor(seed ?? name);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white select-none"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.4 }}
      aria-hidden
    >
      {group ? "#" : initials(name)}
    </span>
  );
}
