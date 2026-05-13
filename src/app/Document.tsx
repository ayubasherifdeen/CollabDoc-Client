import { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import Quill, { Delta } from "quill";
import QuillCursors from "quill-cursors";
import Toolbar from "../components/Toolbar";
import TextEditor from "../components/TextEditor";
import UserPanel from "../components/UserPanel";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Document as DocxDoc,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

// Quill font size — register custom sizes
const SizeStyle = Quill.import("attributors/style/size") as any;
SizeStyle.whitelist = [
  "8px",
  "9",
  "10px",
  "11px",
  "12px",
  "16px",
  "18px",
  "24px",
  "28px",
  "36px",
];
Quill.register(SizeStyle, true);

// Quill font family — register custom fonts
const FontStyle = Quill.import("attributors/style/font") as any;
FontStyle.whitelist = [
  "Times New Roman",
  "DM Sans",
  "Playfair Display",
  "monospace",
  "arial",
  "Courier New",
  "Georgia",
  
];
Quill.register(FontStyle, true);

// Align
const AlignStyle = Quill.import("attributors/style/align") as any;
AlignStyle.whitelist = ["left", "center", "right", "justify"];
Quill.register(AlignStyle, true);

type Identity = { name: string; color: string };
type Props = { docId: string; identity: Identity };
type CursorInfo = { position: number; color: string; name: string };
type SaveStatus = "idle" | "saving" | "saved";

const Document: React.FC<Props> = ({ docId, identity }) => {
  const quillRef = useRef<Quill | null>(null);
  const cursorsModuleRef = useRef<QuillCursors | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [users, setUsers] = useState<
    { id: string; name: string; color: string }[]
  >([]);

  const [docTitle, setDocTitle] = useState("Untitled Document");
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [activeFormats, setActiveFormats] = useState<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    fontSize?: string;
    fontFamily?: string;
    color?: string;
  }>({
    bold: false,
    italic: false,
    underline: false,
    fontSize: "12px",
    fontFamily: "Times New Roman",
    color: "#1c1917",
  });

  const [shareCopied, setShareCopied] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus("saved");
      saveTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
    }, 700);
  }, []);

  // ── Quill ready — wire editor events only ─────────────────────────────────
  const handleQuillReady = useCallback(
    (quill: Quill, cursorsModule: QuillCursors) => {
      quillRef.current = quill;
      cursorsModuleRef.current = cursorsModule;

      quill.on("text-change", (delta, _old, source) => {
        if (source !== "user") return;
        socketRef.current?.emit("text-change", {
          delta,
          contents: quill.getContents(),
        });
        triggerSave();
      });

      quill.on("selection-change", (range) => {
        if (!range) return;
        socketRef.current?.emit("cursor-move", {
          position: range.index,
          color: identity.color,
          name: identity.name,
        });
        const formats = quill.getFormat(range);
        setActiveFormats({
          bold: !!formats.bold,
          italic: !!formats.italic,
          underline: !!formats.underline,
        });
      });
    },
    [triggerSave, identity],
  );

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(
      import.meta.env.VITE_SERVER_URL || "http://localhost:4000",
    );
    socketRef.current = socket;
    // Send identity along with join so server knows who this is
    socketRef.current.emit("join-document", {
      docId,
      name: identity.name,
      color: identity.color,
    });

    socketRef.current.on("load-document", (content: Delta) => {
      quillRef.current?.setContents(content, "silent");
    });

    socketRef.current.on("receive-changes", (delta: Delta) => {
      quillRef.current?.updateContents(delta, "api");
    });

    socketRef.current.on(
      "users-update",
      (u: { id: string; name: string; color: string }[]) => {
        setUsers(u);
      },
    );

    socketRef.current.on(
      "receive-cursor",
      ({ id, position, color, name }: { id: string } & CursorInfo) => {
        const cursors = cursorsModuleRef.current;
        if (!cursors) return;

        // Create cursor if it doesn't exist yet, ignore error if it does
        const existing = cursors.cursors()?.find((c: any) => c.id === id);

        if (!existing) {
          cursors.createCursor(id, name, color);
        }

        // Move it to the right position
        cursors.moveCursor(id, { index: position, length: 0 });
      },
    );

    socketRef.current.on("user-left", (id: string) => {
      cursorsModuleRef.current?.removeCursor(id);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [docId, identity]);

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const execFormat = useCallback((format: string, value: unknown = true) => {
    const quill = quillRef.current;
    if (!quill) return;
    const current = quill.getFormat();
    quill.format(format, current[format] ? false : value, "user");
    const updated = quill.getFormat();
    setActiveFormats({
      bold: !!updated.bold,
      italic: !!updated.italic,
      underline: !!updated.underline,
    });
  }, []);

  const execBlock = useCallback((format: string, value: unknown) => {
    const quill = quillRef.current;
    if (!quill) return;
    const current = quill.getFormat();
    quill.format(format, current[format] === value ? false : value, "user");
  }, []);

  //indentation
  const execIndent = useCallback((direction: "increase" | "decrease") => {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection();
    if (!range) return;
    const current = quill.getFormat(range);
    const indent = parseInt((current.indent as string) || "0", 10);
    const next =
      direction === "increase" ? indent + 1 : Math.max(0, indent - 1);
    quill.format("indent", next || false, "user");
  }, []);

  const execHistory = useCallback((action: "undo" | "redo") => {
    const quill = quillRef.current;
    if (!quill) return;
    (quill as any).history?.[action]?.();
  }, []);

  const execFontSize = useCallback((size: string) => {
    const quill = quillRef.current;
    if (!quill) return;
    quill.format("size", size, "user");
    setActiveFormats((prev) => ({ ...prev, fontSize: size }));
  }, []);

  const execFontFamily = useCallback((font: string) => {
    const quill = quillRef.current;
    if (!quill) return;
    quill.format("font", font, "user");
    setActiveFormats((prev) => ({ ...prev, fontFamily: font }));
  }, []);

  const execTextColor = useCallback((color: string) => {
    const quill = quillRef.current;
    if (!quill) return;
    quill.format("color", color, "user");
    setActiveFormats((prev) => ({ ...prev, color }));
  }, []);

  const execHorizontalRule = useCallback(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const range = quill.getSelection(true);
    quill.insertText(range.index, "\n", "user");
    quill.insertEmbed(range.index + 1, "hr", true, "user");
    quill.insertText(range.index + 2, "\n", "user");
    quill.setSelection(range.index + 3, 0);
  }, []);

  useEffect(() => {
    if (isTitleEditing) titleInputRef.current?.focus();
  }, [isTitleEditing]);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const exportPDF = async () => {
    const editor = quillRef.current?.root;
    if (!editor) return;

    // take a screenshot and scale to 2
    const canvas = await html2canvas(editor, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    // Convert the canvas snapshot to a base64 PNG
    const imgData = canvas.toDataURL("image/png");

    // jsPDF creates an A4 page in portrait
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

    // Scale the image to fit the page width with 10mm margins each side
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 10; // start 10mm from top
    let remaining = imgHeight;

    // Place the image — if content is taller than one page,
    // keep adding pages and shifting the image up each time
    pdf.addImage(imgData, "PNG", 10, y, imgWidth, imgHeight);
    remaining -= pageHeight - 10;

    while (remaining > 0) {
      pdf.addPage();
      y = -(imgHeight - remaining) - 10;
      pdf.addImage(imgData, "PNG", 10, y, imgWidth, imgHeight);
      remaining -= pageHeight;
    }

    // Trigger a download in the browser
    pdf.save(`${docTitle}.pdf`);
    window.alert("Exporting document to pdf");
  };

  const exportDOCX = async () => {
    const quill = quillRef.current;
    if (!quill) return;

    const delta = quill.getContents();
    const paragraphs: Paragraph[] = [];

    let runs: TextRun[] = [];

    const flushParagraph = (blockAttrs: any = {}) => {
      // Determine heading level from block attributes
      const heading =
        blockAttrs.header === 1
          ? HeadingLevel.HEADING_1
          : blockAttrs.header === 2
            ? HeadingLevel.HEADING_2
            : undefined;

      // Map Quill alignment strings to Word's AlignmentType enum
      const alignment =
        blockAttrs.align === "center"
          ? AlignmentType.CENTER
          : blockAttrs.align === "right"
            ? AlignmentType.RIGHT
            : blockAttrs.align === "justify"
              ? AlignmentType.BOTH
              : AlignmentType.LEFT;

      // Indent — Quill uses a number (1, 2, 3...), Word uses twips (720 per level)
      const indent = blockAttrs.indent
        ? { left: blockAttrs.indent * 720 }
        : undefined;

      paragraphs.push(
        new Paragraph({
          children: runs.length ? runs : [new TextRun("")],
          heading,
          alignment,
          indent,
          spacing: { after: 120 },
        }),
      );

      runs = []; // reset for next paragraph
    };

    delta.ops?.forEach((op: any) => {
      if (typeof op.insert !== "string") return;

      // Split on newlines — each \n ends a paragraph
      const lines = op.insert.split("\n");

      lines.forEach((line: string, i: number) => {
        if (line.length > 0) {
          // Build a TextRun with character-level formatting
          runs.push(
            new TextRun({
              text: line,
              bold: !!op.attributes?.bold,
              italics: !!op.attributes?.italic,
              underline: op.attributes?.underline ? {} : undefined,
              // Convert px string to half-points (Word's unit)
              // 1pt = 2 half-points, 1px ≈ 0.75pt → 1px ≈ 1.5 half-points
              size: op.attributes?.size
                ? Math.round(parseFloat(op.attributes.size) * 1.5)
                : 24, // 24 half-points = 12pt default
              color: op.attributes?.color
                ? op.attributes.color.replace("#", "") // Word wants hex without #
                : undefined,
              highlight: op.attributes?.background
                ? "yellow" // Word only supports named highlight colours
                : undefined,
              font: op.attributes?.font || undefined,
            }),
          );
        }

        if (i < lines.length - 1) {
          flushParagraph(op.attributes);
        }
      });
    });

    // Flush any remaining runs as a final paragraph
    flushParagraph();

    // Wrap everything in a Document with one Section
    const doc = new DocxDoc({
      sections: [
        {
          children: [...paragraphs],
        },
      ],
    });

    window.alert("Exporting document to word");
    // Packer.toBlob() serializes the Document object into a real .docx binary
    // saveAs() from file-saver triggers the browser's download dialog
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${docTitle}.docx`);
  };
  return (
    <div className="w-full max-w-[860px] flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          {isTitleEditing ? (
            <input
              ref={titleInputRef}
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              onBlur={() => setIsTitleEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsTitleEditing(false)}
              className="text-[26px] font-semibold text-stone-800 tracking-tight bg-transparent border-b-2 border-orange-500 outline-none max-w-[440px] pb-0.5"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            />
          ) : (
            <h1
              onClick={() => setIsTitleEditing(true)}
              title="Click to rename"
              className="text-[26px] font-semibold text-stone-800 tracking-tight cursor-text border-b-2 border-transparent hover:border-stone-200 transition-colors duration-150 inline-flex items-center gap-2 pb-0.5 leading-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {docTitle}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-stone-300 flex-shrink-0"
              >
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </h1>
          )}

          <div className="flex items-center gap-2.5 flex-wrap text-[12px] text-stone-400">
            <span>doc/{docId}</span>
            <span className="text-stone-200">·</span>
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-orange-500 font-medium">
                <svg
                  className="animate-spin w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.2" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
                Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-emerald-500 font-medium">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </span>
            )}
            {saveStatus === "idle" && <span>All changes saved</span>}
          </div>
        </div>

        <button
          onClick={handleShare}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white border-none cursor-pointer transition-all duration-150 hover:-translate-y-0.5 ${
            shareCopied
              ? "bg-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
              : "bg-orange-600 hover:bg-orange-700 shadow-[0_2px_8px_rgba(234,88,12,0.25)] hover:shadow-[0_4px_12px_rgba(234,88,12,0.35)]"
          }`}
        >
          {shareCopied ? (
            <>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share link
            </>
          )}
        </button>
        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition-all duration-150 shadow-sm"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            PDF
          </button>

          <button
            onClick={exportDOCX}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition-all duration-150 shadow-sm"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Word
          </button>
        </div>
      </div>

      {/* ── Presence ── */}
      <UserPanel users={users} />

      {/* ── Toolbar ── */}
      <Toolbar
        onBold={() => execFormat("bold")}
        onItalic={() => execFormat("italic")}
        onUnderline={() => execFormat("underline")}
        onHeading1={() => execBlock("header", 1)}
        onHeading2={() => execBlock("header", 2)}
        onUndo={() => execHistory("undo")}
        onRedo={() => execHistory("redo")}
        onAlignLeft={() => execBlock("align", false)}
        onAlignCenter={() => execBlock("align", "center")}
        onAlignRight={() => execBlock("align", "right")}
        onJustify={() => execBlock("align", "justify")}
        onIndentIncrease={() => execIndent("increase")}
        onIndentDecrease={() => execIndent("decrease")}
        onBullet={() => execBlock("list", "bullet")}
        onOrdered={() => execBlock("list", "ordered")}
        onHorizontalRule={execHorizontalRule}
        onFontSize={execFontSize}
        onFontFamily={execFontFamily}
        onTextColor={execTextColor}
        activeFormats={activeFormats}
      />

      {/* ── Editor ── */}
      <TextEditor onReady={handleQuillReady} />
    </div>
  );
};

export default Document;
