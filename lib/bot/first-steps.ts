// The path from signing in to the first real save, read from what is actually on the record.
// Each step is done only when the record shows it, never because a page was visited.
export type Step = { key: "bot" | "connect" | "ask" | "save"; title: string; detail: string; done: boolean };

export function firstSteps(input: { botName: string; hasBot: boolean; connections: number; worlds: number; saves: number }): Step[] {
  const name = input.hasBot ? input.botName : "your bot";
  return [
    { key: "bot", title: "Make your bot", detail: "Give it a name and a look below. It acts for you, only as far as you allow.", done: input.hasBot },
    { key: "connect", title: "Connect your AI", detail: `Add solve as a connector in Claude or ChatGPT with the address below. It speaks as ${name}.`, done: input.connections > 0 },
    { key: "ask", title: "Ask for something real", detail: "Try: “Design me a phone stand I can print.” Your AI starts a World and puts the design in it.", done: input.worlds > 0 },
    { key: "save", title: "Make it, then save it", detail: "When it's printed, send your AI a photo. It's saved here with a number.", done: input.saves > 0 },
  ];
}

// The step to show as next, or null once the first save exists.
export const nextStep = (steps: Step[]) => steps.find((s) => !s.done) ?? null;
