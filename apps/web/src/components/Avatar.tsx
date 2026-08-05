type AvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className: string;
  imageClassName?: string;
  fallbackText?: string;
};

function buildFallbackText(name: string) {
  const cleaned = name.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  if (!cleaned) {
    return 'U';
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function Avatar({
  name,
  avatarUrl,
  className,
  imageClassName,
  fallbackText,
}: AvatarProps) {
  const fallback = fallbackText?.trim() || buildFallbackText(name);

  return (
    <span className={className} aria-hidden="true">
      {avatarUrl ? (
        <img
          className={imageClassName}
          src={avatarUrl}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        fallback
      )}
    </span>
  );
}

