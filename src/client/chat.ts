// ---------------------------------------------------------------------------
// Comms: chat channels, macros, and the offline mailbox.
//
//   Enter        open chat · send
//   Esc          close chat
//   Tab (in box) cycle channel
//   F1–F8        fire a macro into the current channel
//
// Commands:
//   /join <name>     join (create) a custom channel and switch to it
//   /leave           leave the current custom channel
//   /ch              cycle channels
//   /macro <n> <txt> store a macro in slot n (1-8)
//   /macros          list macros
//   /msg <player> <text>  leave a message — delivered next time they're online
//   /help            show commands
//
// Offline messages persist in localStorage; on a dedicated server they're
// held in the server's mailbox and delivered on join.
// ---------------------------------------------------------------------------

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface ChatMsg {
  channel: string;
  from: string;
  text: string;
  system?: boolean;
}

interface Mail { from: string; text: string; at: number }

const MAIL_KEY = 'ww_mailbox';
const MACRO_KEY = 'ww_macros';

const DEFAULT_MACROS = [
  'Attack!', 'Defend the base!', 'Need a medic!', 'Enemy spotted!',
  'On my way.', 'Nice shot!', 'Fall back!', 'Thanks!',
];

export class Chat {
  private log = $('chat-log');
  private inputEl = $<HTMLInputElement>('chat-input');
  private channelEl = $('chat-channel');
  private wrap = $('chat');
  private channels = ['ALL', 'TEAM'];
  private chIdx = 0;
  private macros: string[];
  isOpen = false;
  /** outbound hook — multiplayer relays through the socket, offline stays local */
  onSend: (msg: ChatMsg) => void = (m) => this.push(m);
  /** outbound mail hook — multiplayer stores on the server */
  onMail: (to: string, text: string) => void = (to, text) => {
    Chat.storeMail(to, this.myName, text);
    this.push({ channel: 'SYS', from: '', text: `Message stored for ${to} — delivered next time they deploy.`, system: true });
  };

  constructor(private myName: string) {
    this.macros = this.loadMacros();
    this.updateChannelLabel();

    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = this.inputEl.value.trim();
        this.inputEl.value = '';
        if (text) this.handle(text);
        this.close();
      } else if (e.key === 'Escape') {
        this.inputEl.value = '';
        this.close();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.cycleChannel();
      }
    });

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter' && !this.isOpen && !this.wrap.classList.contains('hidden')) {
        e.preventDefault();
        this.open();
      }
      // macros F1–F8
      const fn = /^F([1-8])$/.exec(e.key);
      if (fn && !this.isOpen && !this.wrap.classList.contains('hidden')) {
        e.preventDefault();
        this.sendMacro(Number(fn[1]) - 1);
      }
    });
  }

  show() { this.wrap.classList.remove('hidden'); }
  hide() { this.wrap.classList.add('hidden'); this.close(); }

  open() {
    this.isOpen = true;
    this.wrap.classList.add('open');
    this.inputEl.focus();
  }

  close() {
    this.isOpen = false;
    this.wrap.classList.remove('open');
    this.inputEl.blur();
  }

  get channel() { return this.channels[this.chIdx]; }

  cycleChannel() {
    this.chIdx = (this.chIdx + 1) % this.channels.length;
    this.updateChannelLabel();
  }

  private updateChannelLabel() {
    this.channelEl.textContent = `[${this.channel}]`;
  }

  sendMacro(i: number) {
    const text = this.macros[i];
    if (text) this.onSend({ channel: this.channel, from: this.myName, text });
  }

  /** Parse a typed line: command or plain message to the current channel. */
  private handle(text: string) {
    if (!text.startsWith('/')) {
      this.onSend({ channel: this.channel, from: this.myName, text });
      return;
    }
    const [cmd, ...rest] = text.slice(1).split(' ');
    switch (cmd.toLowerCase()) {
      case 'join': {
        const name = (rest[0] ?? '').toUpperCase().slice(0, 12);
        if (!name) { this.sys('Usage: /join <channel>'); break; }
        if (!this.channels.includes(name)) this.channels.push(name);
        this.chIdx = this.channels.indexOf(name);
        this.updateChannelLabel();
        this.sys(`Joined channel ${name}`);
        break;
      }
      case 'leave': {
        const ch = this.channel;
        if (ch === 'ALL' || ch === 'TEAM') { this.sys('Cannot leave ALL or TEAM.'); break; }
        this.channels = this.channels.filter((c) => c !== ch);
        this.chIdx = 0;
        this.updateChannelLabel();
        this.sys(`Left channel ${ch}`);
        break;
      }
      case 'ch':
        this.cycleChannel();
        break;
      case 'macro': {
        const n = Number(rest[0]);
        const body = rest.slice(1).join(' ');
        if (!n || n < 1 || n > 8 || !body) { this.sys('Usage: /macro <1-8> <text>'); break; }
        this.macros[n - 1] = body.slice(0, 80);
        localStorage.setItem(MACRO_KEY, JSON.stringify(this.macros));
        this.sys(`Macro F${n} set: "${this.macros[n - 1]}"`);
        break;
      }
      case 'macros':
        this.macros.forEach((m, i) => this.sys(`F${i + 1}: ${m}`));
        break;
      case 'msg':
      case 'w': {
        const to = rest[0];
        const body = rest.slice(1).join(' ');
        if (!to || !body) { this.sys('Usage: /msg <player> <text>'); break; }
        this.onMail(to, body.slice(0, 200));
        break;
      }
      case 'help':
        this.sys('/join <ch> · /leave · /ch · /macro <1-8> <text> · /macros · /msg <player> <text> — F1-F8 send macros, Tab cycles channel');
        break;
      default:
        this.sys(`Unknown command: /${cmd} — try /help`);
    }
  }

  private sys(text: string) {
    this.push({ channel: 'SYS', from: '', text, system: true });
  }

  /** Render an incoming or local message. */
  push(msg: ChatMsg) {
    const el = document.createElement('div');
    el.className = `chat-line${msg.system ? ' sys' : ''}`;
    el.innerHTML = msg.system
      ? `<span class="txt">${esc(msg.text)}</span>`
      : `<span class="ch">[${esc(msg.channel)}]</span> <span class="from">${esc(msg.from)}:</span> <span class="txt">${esc(msg.text)}</span>`;
    this.log.appendChild(el);
    while (this.log.children.length > 60) this.log.firstChild?.remove();
    this.log.scrollTop = this.log.scrollHeight;
    // fade out quiet lines after a while
    setTimeout(() => el.classList.add('old'), 9000);
  }

  /** Should this client display a message on this channel? */
  subscribed(channel: string): boolean {
    return channel === 'ALL' || channel === 'TEAM' || this.channels.includes(channel);
  }

  private loadMacros(): string[] {
    try {
      const raw = localStorage.getItem(MACRO_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr) && arr.length === 8) return arr;
      }
    } catch { /* fresh defaults */ }
    return [...DEFAULT_MACROS];
  }

  // ---- offline mailbox (localStorage; the dedicated server keeps its own) ----

  static storeMail(to: string, from: string, text: string) {
    const box = Chat.readBox();
    const key = to.toLowerCase();
    (box[key] ??= []).push({ from, text, at: Date.now() });
    localStorage.setItem(MAIL_KEY, JSON.stringify(box));
  }

  /** Pop and display any messages waiting for this player. */
  deliverMail() {
    const box = Chat.readBox();
    const key = this.myName.toLowerCase();
    const mail = box[key];
    if (!mail?.length) return;
    delete box[key];
    localStorage.setItem(MAIL_KEY, JSON.stringify(box));
    for (const m of mail) {
      const when = new Date(m.at).toLocaleString();
      this.push({ channel: 'MAIL', from: m.from, text: `${m.text} (sent ${when})` });
    }
    this.sys(`${mail.length} stored message${mail.length > 1 ? 's' : ''} delivered.`);
  }

  /** Server-delivered mail (multiplayer). */
  deliverServerMail(items: Mail[]) {
    for (const m of items) {
      const when = new Date(m.at).toLocaleString();
      this.push({ channel: 'MAIL', from: m.from, text: `${m.text} (sent ${when})` });
    }
    if (items.length) this.sys(`${items.length} stored message${items.length > 1 ? 's' : ''} delivered.`);
  }

  private static readBox(): Record<string, Mail[]> {
    try {
      return JSON.parse(localStorage.getItem(MAIL_KEY) ?? '{}') as Record<string, Mail[]>;
    } catch {
      return {};
    }
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
