// node:fs and node:path are only used by the Node runtime of the harness, never in the browser.
const unavailable = () => {
  throw new Error("not available in the browser");
};
export const readdirSync = unavailable;
export const readFileSync = unavailable;
export const join = unavailable;
