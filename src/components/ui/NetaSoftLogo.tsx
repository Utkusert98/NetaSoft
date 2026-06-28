interface LogoProps {
  size?: number;
  variant?: "default" | "white";
}

export function NetaSoftIcon({ size = 36, variant = "default" }: LogoProps) {
  const bg = variant === "white" ? "white" : "#163300";
  const letter = variant === "white" ? "#163300" : "white";
  const accent = "#9fe870";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Arka plan */}
      <rect width="40" height="40" rx="10" fill={bg} />

      {/* Bold N harfi — tam merkezden taşıyor */}
      <path
        d="M8 30 L8 10 L32 30 L32 10"
        stroke={letter}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Aksan nokta — N'nin sağ üst köşesinde yeşil dot */}
      <circle cx="32" cy="10" r="4" fill={accent} />
    </svg>
  );
}

export function NetaSoftLogoFull({
  size = 36,
  variant = "default",
}: LogoProps) {
  const textColor = variant === "white" ? "white" : "#163300";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <NetaSoftIcon size={size} variant={variant} />
      <span
        style={{
          fontSize: size * 0.5,
          fontWeight: 800,
          color: textColor,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        Neta<span style={{ color: "#9fe870" }}>Soft</span>
      </span>
    </div>
  );
}
