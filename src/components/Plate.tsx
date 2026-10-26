import type { ReactNode } from "react";
import { CATEGORY_GROUP, type Category, type PlateGroup } from "../../shared/categories";

// One line drawing per dish category, drawn on a plate in its group color.
// Everything is in a 48x48 box so the same drawing works at row and hero size.

const INK = "#2A1A18";
const WHITE = "#FFFFFF";
const CREAM = "#FBFAF6";
const NOODLE = "#E8B04B";
const TOMATO = "#E8604C";
const ORANGE = "#F28B3C";
const GREEN = "#3E9B6E";
const FRIED = "#E8A54B";
const CHEESE = "#F3CB71";
const BROWN = "#8B5A3C";
const DOUGH = "#F3E9D2";

export const GROUP_COLOR: Record<PlateGroup, string> = {
  mains: "#F3D3C6",
  seafood: "#D5D6E4",
  starches: "#EFDDB5",
  veg: "#DCDCC2",
  sweet: "#ECCDD2",
  plain: "#EFE4E1",
};

const line = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const bowl = <path d="M10 25h28c-1 7-7 11-14 11s-13-4-14-11z" fill={WHITE} {...line} />;
const flatPlate = <ellipse cx="24" cy="28" rx="17" ry="9" fill={WHITE} {...line} />;

const DRAWINGS: Record<Category, ReactNode> = {
  pasta: (
    <>
      {bowl}
      <path d="M14 24c2-5 6-3 8-6s6-4 8-1 6-2 8 2" stroke={NOODLE} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  ),
  noodles: (
    <>
      {bowl}
      <path d="M14 24c2-3 4-3 6 0s4 3 6 0 4-3 6 0 3 2 4 0" stroke={NOODLE} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M27 8l-5 16M33 9l-7 15" {...line} />
    </>
  ),
  rice: (
    <>
      {bowl}
      <path d="M14 25c0-6 4-10 10-10s10 4 10 10z" fill={CREAM} {...line} />
      <path d="M20 19h1M26 18h1M23 21h1M28 22h1" {...line} />
    </>
  ),
  bread: (
    <>
      {flatPlate}
      <path d="M12 28c0-8 5-12 12-12s12 4 12 12z" fill={FRIED} {...line} />
      <path d="M18 19l2 4M24 17v5M30 19l-2 4" {...line} />
    </>
  ),
  dumpling: (
    <>
      {flatPlate}
      <path d="M11 28c0-6 3-9 7-9s7 3 7 9z" fill={DOUGH} {...line} />
      <path d="M23 28c0-6 3-9 7-9s7 3 7 9z" fill={DOUGH} {...line} />
      <path d="M15 20l1 2M18 19v2M21 20l-1 2M27 20l1 2M30 19v2M33 20l-1 2" {...line} strokeWidth="1.2" />
    </>
  ),
  pizza: (
    <>
      <circle cx="24" cy="24" r="15" fill={CHEESE} {...line} />
      <circle cx="24" cy="24" r="11" fill={TOMATO} />
      <circle cx="20" cy="21" r="3" fill={CREAM} />
      <circle cx="28" cy="27" r="3" fill={CREAM} />
      <path d="M25 18c2-1 4 0 4 2" stroke={GREEN} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  soup: (
    <>
      <path d="M10 22h28c-1 9-7 14-14 14S11 31 10 22z" fill={WHITE} {...line} />
      <path d="M14 22c3-3 7-3 10 0s7 3 10 0" stroke={TOMATO} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </>
  ),
  salad: (
    <>
      {bowl}
      <ellipse cx="18" cy="22" rx="5" ry="3" fill={GREEN} {...line} transform="rotate(-20 18 22)" />
      <ellipse cx="29" cy="21" rx="5" ry="3" fill={GREEN} {...line} transform="rotate(20 29 21)" />
      <circle cx="24" cy="23" r="2.6" fill={TOMATO} {...line} />
    </>
  ),
  side: (
    <>
      <path d="M15 22h18l-3 15H18z" fill={TOMATO} {...line} />
      <path d="M17 22l-1-9M21 22v-11M25 22l1-10M29 22l2-8" stroke={NOODLE} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  curry: (
    <>
      {bowl}
      <path d="M12 25c2-3 22-3 24 0" fill="none" {...line} />
      <path d="M12 25h24" stroke={ORANGE} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="19" cy="29" r="1.6" fill={GREEN} />
      <circle cx="27" cy="30" r="1.6" fill={GREEN} />
      <path d="M20 18c0-2 2-2 2-4M26 18c0-2 2-2 2-4" {...line} strokeWidth="1.2" fill="none" />
    </>
  ),
  fish: (
    <>
      <path d="M9 24c6-7 15-8 23-3l7-5v16l-7-5c-8 5-17 4-23-3z" fill={WHITE} {...line} />
      <circle cx="15" cy="23" r="1.5" fill={INK} />
    </>
  ),
  shellfish: (
    <>
      {flatPlate}
      <path d="M16 30c-4-8 1-16 9-16 6 0 9 4 9 8" fill="none" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" />
      <path d="M16 30c-4-8 1-16 9-16 6 0 9 4 9 8" fill="none" {...line} strokeWidth="1" />
      <path d="M20 17l2 4M26 15v4M14 22l4 1" {...line} strokeWidth="1.2" />
    </>
  ),
  sushi: (
    <>
      {flatPlate}
      <circle cx="18" cy="25" r="6" fill={INK} />
      <circle cx="18" cy="25" r="4" fill={CREAM} />
      <circle cx="18" cy="25" r="1.8" fill={ORANGE} />
      <circle cx="30" cy="25" r="6" fill={INK} />
      <circle cx="30" cy="25" r="4" fill={CREAM} />
      <circle cx="30" cy="25" r="1.8" fill={GREEN} />
    </>
  ),
  steak: (
    <>
      {flatPlate}
      <path d="M13 26c0-6 6-9 12-9 7 0 11 3 11 7 0 5-6 7-12 7-7 0-11-2-11-5z" fill={BROWN} {...line} />
      <path d="M18 22l3 6M24 20l3 7M30 21l2 5" stroke="#5E3A24" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  chicken: (
    <>
      {flatPlate}
      <path d="M14 24c0-6 5-10 11-9 5 1 7 6 4 10l-4 3c-4 2-11 2-11-4z" fill={FRIED} {...line} />
      <path d="M28 26l6 5" {...line} strokeWidth="3" stroke={CREAM} />
      <path d="M28 26l6 5" {...line} strokeWidth="1" />
      <circle cx="35" cy="31" r="2" fill={CREAM} {...line} strokeWidth="1.2" />
    </>
  ),
  meat: (
    <>
      {flatPlate}
      <path d="M10 26h28" {...line} />
      <rect x="13" y="21" width="6" height="7" rx="1.5" fill={BROWN} {...line} />
      <rect x="21" y="21" width="6" height="7" rx="1.5" fill={GREEN} {...line} />
      <rect x="29" y="21" width="6" height="7" rx="1.5" fill={BROWN} {...line} />
    </>
  ),
  burger: (
    <>
      <path d="M12 22c0-6 5-9 12-9s12 3 12 9z" fill={FRIED} {...line} />
      <path d="M11 24h26" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="12" y="25" width="24" height="4" rx="2" fill={BROWN} {...line} />
      <path d="M12 31h24c0 3-2 4-4 4H16c-2 0-4-1-4-4z" fill={FRIED} {...line} />
    </>
  ),
  sandwich: (
    <>
      {flatPlate}
      <path d="M12 30l12-16 12 16z" fill={DOUGH} {...line} />
      <path d="M15 26h18" stroke={GREEN} strokeWidth="2" strokeLinecap="round" />
      <path d="M17 23h14" stroke={TOMATO} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  taco: (
    <>
      <path d="M9 30c0-9 7-15 15-15s15 6 15 15z" fill={CHEESE} {...line} />
      <path d="M13 22c2-2 4 0 6-2s4 1 6-1 4 1 6-1 3 1 4 2" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="25" r="1.6" fill={TOMATO} />
      <circle cx="28" cy="24" r="1.6" fill={TOMATO} />
    </>
  ),
  egg: (
    <>
      {flatPlate}
      <path d="M14 26c0-5 4-8 9-8 6 0 11 2 11 6s-4 7-10 7c-6 0-10-1-10-5z" fill={WHITE} {...line} />
      <circle cx="24" cy="25" r="4" fill={NOODLE} {...line} strokeWidth="1.2" />
    </>
  ),
  cheese: (
    <>
      {flatPlate}
      <path d="M12 30V21l24-6v15z" fill={CHEESE} {...line} />
      <path d="M12 21l12-9 12 3" fill={CHEESE} {...line} />
      <circle cx="19" cy="26" r="1.8" fill={FRIED} />
      <circle cx="29" cy="24" r="2.2" fill={FRIED} />
    </>
  ),
  dessert: (
    <>
      <path d="M12 30l12-14 12 14z" fill={DOUGH} {...line} />
      <path d="M16 26h16M19 22h10" stroke={BROWN} strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  cake: (
    <>
      {flatPlate}
      <path d="M14 30V20l20-4v14z" fill={DOUGH} {...line} />
      <path d="M14 25l20-4" stroke={TOMATO} strokeWidth="2" />
      <circle cx="26" cy="15" r="2.4" fill={TOMATO} {...line} strokeWidth="1.2" />
    </>
  ),
  ice_cream: (
    <>
      <path d="M17 24l7 15 7-15z" fill={FRIED} {...line} />
      <circle cx="20" cy="20" r="5" fill="#F7C6CF" {...line} />
      <circle cx="28" cy="20" r="5" fill={CREAM} {...line} />
      <circle cx="24" cy="14" r="5" fill={BROWN} {...line} />
    </>
  ),
  coffee: (
    <>
      <ellipse cx="22" cy="34" rx="14" ry="3.5" fill={WHITE} {...line} />
      <path d="M13 20h18v8c0 4-4 6-9 6s-9-2-9-6z" fill={WHITE} {...line} />
      <path d="M31 22c4 0 4 6 0 6" fill="none" {...line} />
      <ellipse cx="22" cy="20" rx="9" ry="2" fill={BROWN} {...line} />
      <path d="M19 15c0-2 2-2 2-4M24 15c0-2 2-2 2-4" fill="none" {...line} strokeWidth="1.2" />
    </>
  ),
  drink: (
    <>
      <path d="M17 14h14l-2 23H19z" fill={WHITE} {...line} />
      <path d="M18 22h12l-1 14H19z" fill={ORANGE} />
      <path d="M26 8l-2 22" {...line} stroke={TOMATO} strokeWidth="2" />
      <path d="M17 14h14l-2 23H19z" fill="none" {...line} />
    </>
  ),
  cocktail: (
    <>
      <path d="M12 14h24L24 27z" fill="#F7C6CF" {...line} />
      <path d="M24 27v10M18 38h12" {...line} />
      <circle cx="29" cy="15" r="2.6" fill={GREEN} {...line} strokeWidth="1.2" />
    </>
  ),
  wine: (
    <>
      <path d="M16 11h16c0 9-3 15-8 15s-8-6-8-15z" fill={WHITE} {...line} />
      <path d="M16.6 17h14.8c-1 6-3.6 9-7.4 9s-6.4-3-7.4-9z" fill="#8E2A3A" />
      <path d="M24 26v11M18 38h12" {...line} />
    </>
  ),
  beer: (
    <>
      <rect x="14" y="16" width="16" height="21" rx="2" fill={NOODLE} {...line} />
      <path d="M30 20h3c2 0 3 1 3 3v6c0 2-1 3-3 3h-3" fill="none" {...line} />
      <path d="M13 17c0-4 3-5 5-4 1-2 4-3 6-1 2-2 6-1 6 2 1 1 1 3 0 3z" fill={CREAM} {...line} />
    </>
  ),
  other: flatPlate,
};

export function Plate({
  category,
  size = 44,
  label,
}: {
  category: Category;
  size?: number;
  /** Set for a meaningful image; rows leave it out because the name is next to it. */
  label?: string;
}) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ flexShrink: 0 }} {...a11y}>
      <circle cx="24" cy="24" r="24" fill={GROUP_COLOR[CATEGORY_GROUP[category] ?? "plain"]} />
      {DRAWINGS[category] ?? DRAWINGS.other}
    </svg>
  );
}
