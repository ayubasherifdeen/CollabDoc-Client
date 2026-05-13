import React from "react";
import Quill from "quill";
import QuillCursors from "quill-cursors";
import "quill/dist/quill.snow.css";
import { useEffect, useState, useRef } from "react";

Quill.register("modules/cursors", QuillCursors);

type Props = {
  onReady: (quill: Quill, cursors: QuillCursors) => void;
};

const TextEditor: React.FC<Props> = ({ onReady }) => {
  const quillRef = useRef<Quill | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || quillRef.current) return;

    // Register horizontal rule blot
    const BlockEmbed = Quill.import("blots/block/embed") as any;
    class HrBlot extends BlockEmbed {
      static blotName = "hr";
      static tagName = "hr";
      static create() {
        const node = super.create();
        node.style.cssText =
          "border:none;border-top:2px solid #e7e5e4;margin:16px 0;";
        return node;
      }
    }
    Quill.register(HrBlot, true);

    const editorDiv = document.createElement("div");
    el.appendChild(editorDiv);

    const quill = new Quill(editorDiv, {
      theme: "snow",
      modules: {
        toolbar: false,
        cursors: {
          hideDelayMs: 2000,
          hideSpeedMs: 300,
          selectionChangeSource: null,
          transformOnTextChange: true,
        },
      },
      placeholder:
        "Begin writing here -  your words are synce live across all collaborators... ",
    });

    quillRef.current = quill;

    quill.on("text-change", () => {
      const text = quill.getText();
      const trimmed = text.trim();
      setCharCount(trimmed.length);
      setWordCount(trimmed ? trimmed.split(/\s+/).length : 0);
    });

    quill.root.addEventListener("focus", () => setIsFocused(true));
    quill.root.addEventListener("blur", () => setIsFocused(false));
    const cursorsModule = quill.getModule("cursors") as QuillCursors;
    onReady(quill, cursorsModule);

    el.style.height = "auto";
    el.style.height = Math.max(520, el.scrollHeight) + "px";

    return () => {
      quillRef.current = null;
      if (el) el.innerHTML = "";
    };
  }, []);

  return (
    <div className="flex flex-col gap-0">
      <style>{`
        .collab-paper .ql-editor {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15.5px;
          font-weight: 300;
          line-height: 1.85;
          color: #1c1917;
          padding: 20px 28px 28px 64px;
          min-height: 520px;
          caret-color: #ea580c;
          letter-spacing: 0.01em;
        }
        .collab-paper .ql-editor.ql-blank::before {
          font-style: italic;
          color: #d4cdc5;
          font-weight: 300;
          left: 64px;
          right: 28px;
        }
        .collab-paper .ql-editor ::selection { background: #fed7aa; }
        .collab-paper .ql-container { border: none; font-size: inherit; }
        .collab-paper .ql-editor:focus { outline: none; }
        .collab-paper .ql-editor h1 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 26px;
          font-weight: 600;
          line-height: 1.3;
          color: #1c1917;
          margin-bottom: 8px;
        }
        .collab-paper .ql-editor h2 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 20px;
          font-weight: 500;
          line-height: 1.4;
          color: #1c1917;
          margin-bottom: 6px;
        }
        .collab-paper .ql-editor p { margin-bottom: 4px; }
        .collab-paper .ql-editor ul,
        .collab-paper .ql-editor ol { padding-left: 20px; }
        .collab-paper .ql-editor a { color: #ea580c; }
        .collab-paper .ql-editor blockquote {
          border-left: 3px solid #fed7aa;
          padding-left: 16px;
          color: #78716c;
          font-style: italic;
          margin: 12px 0;
        }
        .collab-paper .ql-editor code {
          background: #f5f5f4;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 13.5px;
          color: #c2410c;
        }
        .ql-cursor {
  pointer-events: none;
}

.ql-cursor-caret {
  margin-left: -1px;
}

.ql-cursor-flag {
  opacity: 1 !important;
  transition: opacity 0.2s ease;
}

.ql-cursor-name {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  color: white;
  white-space: nowrap;
}
      `}</style>

      {/* Paper card */}
      <div
        className={`
          bg-white border rounded-xl overflow-hidden relative
          transition-shadow duration-200
          ${
            isFocused
              ? "border-orange-300 shadow-[0_0_0_3px_rgba(234,88,12,0.10),0_4px_16px_rgba(28,25,23,0.08)]"
              : "border-stone-200 shadow-md"
          }
        `}
      >
        {/* Margin line */}
        <div className="absolute top-0 left-[52px] bottom-0 w-px bg-orange-100 pointer-events-none z-[1]" />

        {/* Quill mounts here, in place of text area */}
        <div ref={containerRef} className="relative z-[2]" />
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 px-1 pt-2 text-[11.5px] text-stone-400 tracking-wide">
        <span>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span className="text-stone-200">·</span>
        <span>{charCount} characters</span>
        <div className="flex-1" />
        <span
          className={`flex items-center gap-1.5 transition-colors duration-200 ${
            isFocused ? "text-orange-500 font-medium" : "text-stone-400"
          }`}
        >
          {isFocused && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block" />
          )}
          {isFocused ? "Editing" : "Click to edit"}
        </span>
      </div>
    </div>
  );
};

export default TextEditor;
