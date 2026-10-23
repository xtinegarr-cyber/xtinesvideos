// How long the free VIP pass from a Reddit post lasts. Safe to use in
// browser code too (no server imports).
export const PASS_MINUTES = Math.max(1, Number(process.env.NEXT_PUBLIC_FREE_VIP_MINUTES) || 30);
