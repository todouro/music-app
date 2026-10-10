## 2025-05-18 - Semantic Buttons for Theme Selection Cards
**Learning:** Using interactive `<div>` elements with keydown handlers for complex card pickers (like theme modes) causes accessibility friction with screen readers and focus rings. Native `<button>` elements with `aria-pressed` provide superior screen reader feedback and keyboard navigation out of the box.
**Action:** Always wrap visual option cards and mode selectors in native `<button type="button">` with `aria-pressed={isSelected}` and clean label attributes.
