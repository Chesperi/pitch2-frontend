export type FinanceVisibility = "HIDDEN" | "VISIBLE";

export function canSeeFinance(user: {
  user_level: string;
  finance_visibility: FinanceVisibility;
}): boolean {
  const alwaysVisible = ["MANAGER", "MASTER"];
  if (alwaysVisible.includes(String(user.user_level ?? "").toUpperCase())) {
    return true;
  }
  return user.finance_visibility === "VISIBLE";
}
