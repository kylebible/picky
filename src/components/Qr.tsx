import { encode } from "uqr";

/** A QR code drawn as SVG, with high error correction so the rose dot in the middle doesn't break it. */
export function Qr({ text, size = 230, label }: { text: string; size?: number; label: string }) {
  const { data, size: n } = encode(text, { ecc: "H", border: 0 });
  const path = data.flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1H${x}z` : ""))).join("");
  const mid = n / 2;
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#FFFFFF" />
      <path d={path} fill="#2A1A18" />
      <rect x={mid - 2.5} y={mid - 2.5} width="5" height="5" fill="#FFFFFF" />
      <rect x={mid - 2} y={mid - 2} width="4" height="4" rx="2" fill="#D9868F" />
    </svg>
  );
}
