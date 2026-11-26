export function fullScreenEnabled() {
  return (
    !!document.fullscreenEnabled &&
    typeof document.documentElement.requestFullscreen === "function"
  );
}
