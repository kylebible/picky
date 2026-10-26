// Pure match logic used by the Split it session. Kept free of Durable Object
// APIs so it can be unit tested.

export type Swipe = { userId: string; dishId: string; liked: boolean };

/** Returns true when every member has said yes to the dish. */
export function isMatch(swipes: Swipe[], dishId: string, memberIds: string[]): boolean {
  if (memberIds.length < 2) return false;
  const yes = new Set(swipes.filter((s) => s.dishId === dishId && s.liked).map((s) => s.userId));
  return memberIds.every((id) => yes.has(id));
}
