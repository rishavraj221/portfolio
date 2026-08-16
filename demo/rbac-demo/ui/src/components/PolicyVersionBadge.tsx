import { useAuth } from "../context/AuthContext";

export function PolicyVersionBadge() {
  const { me } = useAuth();
  if (!me) return null;

  return (
    <div className={`badge ${me.stale ? "badge-stale" : "badge-fresh"}`}>
      token pv {me.tokenPolicyVersion} / tenant pv {me.currentPolicyVersion}
      {me.stale ? " -- stale, refreshing..." : " -- current"}
    </div>
  );
}
