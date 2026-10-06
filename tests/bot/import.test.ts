import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatConversationMemory, parseChatGptExport } from "../../lib/bot/import";

function node(id: string, parent: string | null, role: string | null, text: string | null) {
  return {
    id,
    parent,
    children: [],
    message:
      role === null
        ? null
        : {
            id,
            author: { role, name: null, metadata: {} },
            create_time: 1700000000,
            content: { content_type: "text", parts: text === null ? [] : [text] },
          },
  };
}

const exportJson = [
  {
    title: "Weekend plans",
    create_time: 1700000000,
    update_time: 1700000100,
    current_node: "c",
    mapping: {
      a: node("a", null, null, null),
      b: node("b", "a", "user", "What should I do this weekend?"),
      c: node("c", "b", "assistant", "Go hiking."),
    },
  },
  {
    title: "Empty",
    create_time: 1700000000,
    mapping: { a: node("a", null, null, null) },
    current_node: "a",
  },
];

describe("chatgpt export import", () => {
  it("parses conversations in order, skipping empties", () => {
    const convs = parseChatGptExport(exportJson);
    assert.equal(convs.length, 1);
    assert.equal(convs[0].title, "Weekend plans");
    assert.deepEqual(
      convs[0].messages.map((m) => m.role),
      ["user", "assistant"],
    );
    assert.equal(convs[0].messages[0].text, "What should I do this weekend?");
  });

  it("rejects non-arrays", () => {
    assert.throws(() => parseChatGptExport({}), /array/);
  });

  it("formats a memory with title and transcript", () => {
    const convs = parseChatGptExport(exportJson);
    const mem = formatConversationMemory(convs[0]);
    assert.match(mem.title, /Weekend plans/);
    assert.match(mem.text, /You: What should I do this weekend\?/);
    assert.match(mem.text, /Assistant: Go hiking\./);
  });
});
