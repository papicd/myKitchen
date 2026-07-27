import { RecipeType } from "@/lib/types";
import styles from "./RecipeTypeBadges.module.scss";

type Props = {
  types: RecipeType[];
  maxVisible?: number;
};

function getTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : normalized;

  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance >= 150 ? "#1f2937" : "#ffffff";
}

export function RecipeTypeBadges({ types, maxVisible }: Props) {
  if (types.length === 0) {
    return null;
  }

  const visible = typeof maxVisible === "number" ? types.slice(0, maxVisible) : types;

  return (
    <div className={styles.types}>
      {visible.map((type) => (
        <span
          key={type.id}
          className={styles.badge}
          style={{
            backgroundColor: type.color,
            color: getTextColor(type.color),
          }}
        >
          {type.name}
        </span>
      ))}
    </div>
  );
}

