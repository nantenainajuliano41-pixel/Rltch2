import { avatarColor } from "../lib/format";

interface AvatarProps {
  name: string;
  size?: "sm" | "md";
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const dims = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div
      className={`${dims} ${avatarColor(name)} flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
