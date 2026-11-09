import { useEffect } from "react";
import { db } from "./db";

const motionPreference = "(prefers-reduced-motion: reduce)";
const prefersReducedMotion = () => matchMedia(motionPreference).matches;

export function useStartupReady(ready: boolean) {
  useEffect(() => {
    if (!ready || document.documentElement.hasAttribute("data-tafe-ready"))
      return;
    const delay = prefersReducedMotion()
      ? 0
      : Math.max(0, 600 - performance.now());
    const timer = window.setTimeout(() => {
      document.documentElement.setAttribute("data-tafe-ready", "");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [ready]);
}

let activeSignOut: ReturnType<typeof db.auth.signOut> | undefined;
let outroTimer = 0;

export function signOutWithMotion(
  options?: Parameters<typeof db.auth.signOut>[0],
) {
  if (activeSignOut) return activeSignOut;
  if (prefersReducedMotion()) return db.auth.signOut(options);

  const root = document.documentElement;
  window.clearTimeout(outroTimer);
  const dismiss = () => root.removeAttribute("data-tafe-outro");
  root.setAttribute("data-tafe-outro", "");
  const started = performance.now();
  // Restore the controls if sign-out needs more than one visual beat.
  outroTimer = window.setTimeout(dismiss, 950);
  activeSignOut = db.auth.signOut(options).finally(() => {
    // Never hold up the auth result or wait for a slow network animation.
    activeSignOut = undefined;
    window.clearTimeout(outroTimer);
    outroTimer = window.setTimeout(
      dismiss,
      Math.max(0, 420 - (performance.now() - started)),
    );
  });
  return activeSignOut;
}
