// ---------------------------------------------------------------------------
// THE CONVERSATION (#124 — the RPG layer, v1). Robert: "conversations.
// Yes/No. I wanna use that comic book fonts, though."
//
// A comic PANEL, not a terminal card: bone-white bubble, hard ink border,
// offset shadow, hand-letterer type (comic stack; a vendored display font can
// slot in later), a tilted speaker chip, and 1-9 keyed choices. Data-driven:
// a conversation is a flat node map — choices jump by `next`, fire `act`, or
// close when neither is set. Walking away mid-sentence closes it too (the
// interact loop owns that) — an RPG in a war zone keeps its feet.
// ---------------------------------------------------------------------------

export interface DialogueChoice {
  label: string;
  /** node id to jump to; omitted = the conversation closes after act */
  next?: string;
  /** side effect (take the marker, leave the shop) — runs before the jump */
  act?: () => void;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices: DialogueChoice[];
}

let root: HTMLElement | null = null;
let nodes: Record<string, DialogueNode> = {};
let open = false;

export function dialogueOpen(): boolean { return open; }

function ensureRoot(): HTMLElement {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'dialogue';
  root.className = 'hidden';
  document.body.appendChild(root);
  return root;
}

function render(node: DialogueNode) {
  const el = ensureRoot();
  el.innerHTML = `
    <div class="comic-panel">
      <span class="comic-speaker">${node.speaker}</span>
      <div class="comic-text">${node.text}</div>
      <div class="comic-choices">
        ${node.choices.map((c, i) => `<button data-i="${i}"><b>${i + 1}</b> ${c.label}</button>`).join('')}
      </div>
    </div>`;
  el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.onclick = () => pick(Number(b.dataset.i));
  });
}

function pick(i: number) {
  const current = nodes[currentId];
  const choice = current?.choices[i];
  if (!choice) return;
  choice.act?.();
  if (choice.next && nodes[choice.next]) {
    currentId = choice.next;
    render(nodes[currentId]);
  } else {
    closeDialogue();
  }
}

let currentId = '';

function onKey(e: KeyboardEvent) {
  if (!open) return;
  const n = Number(e.key);
  if (n >= 1 && n <= 9) { pick(n - 1); e.stopPropagation(); }
  if (e.key === 'Escape') { closeDialogue(); e.stopPropagation(); }
}

export function openDialogue(tree: { nodes: Record<string, DialogueNode>; start: string }) {
  nodes = tree.nodes;
  currentId = tree.start;
  const el = ensureRoot();
  el.classList.remove('hidden');
  render(nodes[currentId]);
  if (!open) window.addEventListener('keydown', onKey, true);
  open = true;
}

export function closeDialogue() {
  if (!open) return;
  open = false;
  window.removeEventListener('keydown', onKey, true);
  root?.classList.add('hidden');
}
