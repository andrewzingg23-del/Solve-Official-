import type { VisualExpression } from "./contract";
import { validateExpressionPatch } from "./compiler";

/** A single presentation-token bridge for SOLVE and generated modules.
 * Generated apps consume these tokens instead of introducing a second design system.
 * This function does not accept arbitrary CSS or remote asset URLs.
 */
export function expressionTokens(expression: VisualExpression): Record<string, string> {
  validateExpressionPatch(expression);
  const dark = expression.mode === "dark";
  return {
    "--solve-background": dark ? "#111214" : "#ffffff",
    "--solve-foreground": dark ? "#f5f5f5" : "#181818",
    "--solve-surface": dark ? "#1d1e20" : "#f5f5f5",
    "--solve-border": dark ? "#37383b" : "#e5e5e5",
    "--solve-accent": expression.accent,
    "--solve-radius": "16px",
    "--solve-gap": expression.density === "compact" ? "12px" : expression.density === "spacious" ? "28px" : "20px",
    "--solve-surface-opacity": expression.surface === "glass" ? "0.82" : "1",
  };
}
