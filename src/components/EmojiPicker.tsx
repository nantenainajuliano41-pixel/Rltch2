import { useEffect, useRef, useState } from "react";

interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "faces",
    label: "Émotions",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤗",
      "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶",
      "😏", "😒", "🙄", "😬", "😌", "😔", "😪", "😴",
      "😷", "🤒", "🥵", "🥶", "🥳", "😎", "🤓", "🧐",
      "😕", "😟", "😮", "😲", "😳", "🥺", "😢", "😭",
      "😤", "😠", "😡", "🤯", "😱", "😨", "😰", "😓",
    ],
  },
  {
    id: "gestures",
    label: "Gestes",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏",
      "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜",
      "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪",
    ],
  },
  {
    id: "hearts",
    label: "Cœurs & Symboles",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💔", "❤️‍🔥", "💕", "💞", "💓", "💗", "💖", "💘",
      "✨", "🌟", "⭐", "🔥", "💥", "💫", "💯", "✅",
      "❌", "⚠️", "❓", "❗", "💬", "👀", "🎉", "🎊",
    ],
  },
  {
    id: "lifestyle",
    label: "Quotidien",
    icon: "☕",
    emojis: [
      "☕", "🍵", "🍕", "🍔", "🍟", "🥐", "🍰", "🍫",
      "🍷", "🍻", "🥂", "🎵", "🎶", "🎧", "🎮", "📱",
      "💻", "📷", "🚀", "✈️", "🚗", "🏠", "🌞", "🌙",
      "🌈", "☔", "⚡", "🌸", "🌿", "🍀", "🐶", "🐱",
    ],
  },
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(EMOJI_CATEGORIES[0].id);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const current = EMOJI_CATEGORIES.find((c) => c.id === activeTab) ?? EMOJI_CATEGORIES[0];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Sélecteur d'emojis Noto Color Emoji"
      className="absolute bottom-full left-0 z-40 mb-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl sm:w-80"
    >
      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex gap-1" role="tablist" aria-label="Catégories d'emojis">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={cat.id === activeTab}
              aria-label={cat.label}
              title={cat.label}
              onClick={() => setActiveTab(cat.id)}
              className={`noto-color-emoji-regular rounded-lg px-2 py-1 text-base transition ${
                cat.id === activeTab
                  ? "bg-indigo-50 ring-1 ring-indigo-200"
                  : "hover:bg-slate-100"
              }`}
            >
              {cat.icon}
            </button>
          ))}
        </div>
        <span className="text-xs font-medium text-slate-400">{current.label}</span>
      </div>

      <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto pr-1">
        {current.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            aria-label={`Insérer ${emoji}`}
            className="noto-color-emoji-regular flex h-8 w-8 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
