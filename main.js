// 字数统计 / 阅读时长插件
// 读取当前笔记（有选区则统计选区），显示汉字数、英文单词数、字符数、行数与预计阅读时长。
export default {
  activate(context) {
    const STYLE = `
.wc-root { font-family: inherit; color: inherit; padding: 4px 2px; }
.wc-empty { color: color-mix(in srgb, currentColor 55%, transparent); font-size: 13px; padding: 16px 4px; }
.wc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.wc-card { border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 8px; padding: 14px 16px; }
.wc-card .num { font-size: 26px; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.wc-card .lbl { margin-top: 4px; font-size: 12px; color: color-mix(in srgb, currentColor 55%, transparent); }
.wc-time { margin-top: 14px; padding: 12px 16px; border-radius: 8px; background: color-mix(in srgb, #3f7d5c 12%, transparent); }
.wc-time .num { font-size: 20px; font-weight: 650; }
.wc-time .lbl { font-size: 12px; color: color-mix(in srgb, currentColor 65%, transparent); }
.wc-note { margin-top: 10px; font-size: 12px; color: color-mix(in srgb, currentColor 50%, transparent); }
@media (max-width: 340px) { .wc-grid { grid-template-columns: 1fr; } }
`;

    function count(md) {
      if (!md) {
        return { chinese: 0, words: 0, chars: 0, nonSpace: 0, lines: 0, minutes: 0 };
      }
      const chinese = (md.match(/[\u4e00-\u9fff]/g) || []).length;
      const words = (md.match(/[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g) || []).length;
      const chars = md.length;
      const nonSpace = md.replace(/\s+/g, "").length;
      const lines = md.split("\n").length;
      const total = chinese + words;
      const minutes = total === 0 ? 0 : Math.max(1, Math.ceil(chinese / 400 + words / 200));
      return { chinese, words, chars, nonSpace, lines, minutes };
    }

    function card(num, lbl) {
      const el = document.createElement("div");
      el.className = "wc-card";
      const n = document.createElement("div");
      n.className = "num";
      n.textContent = String(num);
      const l = document.createElement("div");
      l.className = "lbl";
      l.textContent = lbl;
      el.append(n, l);
      return el;
    }

    const disposePanel = context.ui.panels.register({
      id: "word-count-panel",
      title: "字数统计",
      purpose: "dashboard",
      presentation: "dialog",
      mount(container, { shell }) {
        shell.set({
          header: {
            title: "字数统计",
            description: "当前笔记的字数与预计阅读时长",
            actions: [{ id: "refresh", label: "刷新" }],
          },
          onAction(id) {
            if (id === "refresh") render();
          },
        });

        const style = document.createElement("style");
        style.textContent = STYLE;
        const root = document.createElement("div");
        root.className = "wc-root";
        root.append(style);
        container.append(root);

        async function render() {
          const doc = await context.editor.getDocument();
          const sel = await context.editor.getSelection();
          const hasSelection = sel && !sel.empty;
          const md = hasSelection ? sel.text : doc ? doc.contentMarkdown : "";
          const s = count(md);

          root.replaceChildren(style);

          if (!doc) {
            const empty = document.createElement("div");
            empty.className = "wc-empty";
            empty.textContent = "请先打开一篇笔记，再查看字数统计。";
            root.append(empty);
            return;
          }

          const grid = document.createElement("div");
          grid.className = "wc-grid";
          grid.append(
            card(s.chinese, "汉字"),
            card(s.words, "英文单词"),
            card(s.nonSpace, "非空白字符"),
            card(s.lines, "行数"),
          );
          root.append(grid);

          const time = document.createElement("div");
          time.className = "wc-time";
          const tn = document.createElement("div");
          tn.className = "num";
          tn.textContent = s.minutes === 0 ? "—" : "约 " + s.minutes + " 分钟";
          const tl = document.createElement("div");
          tl.className = "lbl";
          tl.textContent = "预计阅读时长（汉字约 400 字/分 · 英文约 200 词/分）";
          time.append(tn, tl);
          root.append(time);

          const note = document.createElement("div");
          note.className = "wc-note";
          note.textContent = (hasSelection ? "统计范围：当前选区 · " : "统计范围：整篇笔记 · ") +
            "总字符（含空白）" + s.chars;
          root.append(note);
        }

        render();
        return () => root.remove();
      },
    });

    const disposeCmd = context.commands.register({
      id: "open-word-count",
      title: "字数统计",
      listed: true,
      async run() {
        await context.ui.panels.open("word-count-panel");
      },
    });

    return () => {
      disposeCmd();
      disposePanel();
    };
  },
};
