// Use the part's document: detached sheets belong to another browser window.
export function captureFieldState(part) {
  const field = part.ownerDocument.activeElement;
  if (!field || !part.contains(field) || !field.matches("input, textarea, select")) return null;
  if (!field.name && !field.hasAttribute("data-actor-name")) return null;
  return {
    name: field.name,
    nickname: field.hasAttribute("data-actor-name"),
    start: field.selectionStart,
    end: field.selectionEnd,
    direction: field.selectionDirection,
    scrollTop: field.scrollTop,
    scrollLeft: field.scrollLeft
  };
}

export function restoreFieldState(part, fieldState, scrollPositions = []) {
  if (fieldState) {
    const field = [...part.querySelectorAll("input, textarea, select")].find(candidate => (
      fieldState.nickname ? candidate.hasAttribute("data-actor-name") : candidate.name === fieldState.name
    ));
    if (field && !field.disabled) {
      field.focus({ preventScroll: true });
      // Number inputs and selects do not support text selection.
      if (typeof fieldState.start === "number" && typeof field.setSelectionRange === "function") {
        field.setSelectionRange(fieldState.start, fieldState.end, fieldState.direction);
      }
      field.scrollTop = fieldState.scrollTop;
      field.scrollLeft = fieldState.scrollLeft;
    }
  }
  // Foundry restores disclosures after scrolling. Reapply scroll once their
  // height is restored, otherwise a collapsed section clamps the position.
  for (const [selector, scrollTop, scrollLeft] of scrollPositions) {
    const element = selector === "" ? part : part.querySelector(selector);
    if (element) Object.assign(element, { scrollTop, scrollLeft });
  }
}
