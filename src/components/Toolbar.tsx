import React, { useRef, useState, useEffect } from "react";

type ToolbarProps = {
  onBold?: () => void;
  onItalic?: () => void;
  onUnderline?: () => void;
  onHeading1?: () => void;
  onHeading2?: () => void;
  onAlignLeft?: () => void;
  onAlignCenter?: () => void;
  onAlignRight?: () => void;
  onJustify?: () => void;
  onBullet?: () => void;
  onOrdered?: () => void;
  onIndentIncrease?: () => void;
  onIndentDecrease?: () => void;
  onHorizontalRule?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFontSize?: (size: string) => void;
  onFontFamily?: (font: string) => void;
  onTextColor?: (color: string) => void;
  onHighlight?: (color: string) => void;
  activeFormats?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSize?: string;
    fontFamily?: string;
    color?: string;
  };
};

const FONT_SIZES = [
  { label: "8",  value: "8px"  },
  { label: "9",  value: "9px"  },
  { label: "10", value: "10px" },
  { label: "11", value: "11px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "28", value: "28px" },
  { label: "36", value: "36px" },
];

const FONT_FAMILIES = [
  { label: "DM Sans",          value: "DM Sans" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Georgia",          value: "Georgia" },
  { label: "Arial",            value: "Arial" },
  { label: "Times New Roman",  value: "Times New Roman" },
  { label: "Courier New",      value: "Courier New" },
  { label: "Monospace",        value: "monospace" },
];

const TEXT_COLORS = [
  "#1c1917", "#dc2626", "#ea580c",
  "#ca8a04", "#16a34a", "#2563eb",
  "#7c3aed", "#db2777", "#78716c",
];

const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bae6fd",
  "#fecaca", "#e9d5ff", "#fed7aa",
  "transparent",
];

// ── Primitives (unchanged from before) ───────────────────────────────────────

const Sep = () => (
  <div className="w-px self-stretch bg-stone-200 mx-2 my-0.5 flex-shrink-0" />
);

// Group label sits BELOW the controls — Word style
const Group: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col items-center gap-1 flex-shrink-0">
    <div className="flex items-center gap-0.5 flex-wrap justify-center">{children}</div>
    <span className="text-[9px] font-semibold tracking-widest uppercase text-stone-400 select-none">
      {label}
    </span>
  </div>
);

const Btn: React.FC<{
  onClick?: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`
      relative inline-flex items-center justify-center w-8 h-8 rounded-lg
      border-none text-[13px] font-semibold cursor-pointer
      transition-all duration-100 flex-shrink-0 group
      ${active
        ? "bg-orange-100 text-orange-600 ring-1 ring-inset ring-orange-300"
        : "bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800 hover:-translate-y-px"
      }
    `}
  >
    {children}
    <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-stone-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
      {title}
    </span>
  </button>
);

const Sel: React.FC<{
  value?: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  width: number;
  title: string;
}> = ({ value, onChange, options, width, title }) => (
  <select
    title={title}
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    style={{ width }}
    className="h-8 rounded-lg border border-stone-200 bg-white text-stone-600 text-[12px] px-2 cursor-pointer outline-none transition-all duration-100 hover:border-stone-300 focus:border-orange-400 focus:ring-1 focus:ring-orange-100 flex-shrink-0"
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const ColorPicker: React.FC<{
  color?: string;
  colors: string[];
  onChange: (c: string) => void;
  trigger: React.ReactNode;
  label: string;
}> = ({ color, colors, onChange, trigger, label }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        title={label}
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-lg bg-transparent hover:bg-stone-100 border-none cursor-pointer flex flex-col items-center justify-center gap-[3px] transition-colors duration-100"
      >
        {trigger}
      </button>
      {open && (
        <div className="absolute top-[40px] left-0 z-50 bg-white border border-stone-200 rounded-xl shadow-xl p-3 flex flex-col gap-2 w-[128px]">
          <span className="text-[9px] font-semibold tracking-widest uppercase text-stone-400">{label}</span>
          <div className="flex flex-wrap gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setOpen(false); }}
                className="w-6 h-6 rounded cursor-pointer border-2 flex-shrink-0 transition-transform hover:scale-110"
                style={{
                  background: c === "transparent" ? "linear-gradient(135deg,#fff 40%,#f00 40%)" : c,
                  borderColor: color === c ? "#1c1917" : "transparent",
                  boxShadow: color === c ? `0 0 0 1px ${c}` : "none",
                }}
              />
            ))}
            <label className="w-6 h-6 rounded border-2 border-dashed border-stone-300 flex items-center justify-center cursor-pointer hover:border-stone-500 overflow-hidden">
              <input type="color" className="opacity-0 absolute w-0 h-0" onChange={(e) => { onChange(e.target.value); setOpen(false); }} />
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const UndoIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17A9 9 0 006 5.1L3 8"/></svg>;
const RedoIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0115-2.9L21 8"/></svg>;
const AlignLIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="14" y2="12"/><line x1="3" y1="18" x2="17" y2="18"/></svg>;
const AlignCIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>;
const AlignRIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>;
const JustifyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const BulletIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>;
const OrderedIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>;
const IndIncIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/><polyline points="3 8 7 12 3 16"/></svg>;
const IndDecIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/><polyline points="7 8 3 12 7 16"/></svg>;
const HRIcon      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="7" x2="8" y2="7"/><line x1="16" y1="7" x2="21" y2="7"/><line x1="3" y1="17" x2="8" y2="17"/><line x1="16" y1="17" x2="21" y2="17"/></svg>;

// ── Main Toolbar ──────────────────────────────────────────────────────────────
export const Toolbar: React.FC<ToolbarProps> = ({
  onBold, onItalic, onUnderline,
  onHeading1, onHeading2,
  onAlignLeft, onAlignCenter, onAlignRight, onJustify,
  onBullet, onOrdered, onIndentIncrease, onIndentDecrease,
  onHorizontalRule,
  onUndo, onRedo,
  onFontSize, onFontFamily, onTextColor, onHighlight,
  activeFormats = {},
}) => {
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm mb-3 px-3 py-2 flex items-stretch gap-0 flex-wrap">

      {/* Undo / Redo */}
      <Group label="Clipboard">
        <Btn onClick={onUndo} title="Undo"><UndoIcon /></Btn>
        <Btn onClick={onRedo} title="Redo"><RedoIcon /></Btn>
      </Group>

      <Sep />

      {/* Font family + size stacked, then B I U color below */}
      <Group label="Font">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Sel title="Font" value={activeFormats.fontFamily} onChange={(v) => onFontFamily?.(v)} options={FONT_FAMILIES} width={138} />
            <Sel title="Size" value={activeFormats.fontSize} onChange={(v) => onFontSize?.(v)} options={FONT_SIZES} width={60} />
          </div>
          <div className="flex items-center gap-0.5">
            <Btn onClick={onBold} active={activeFormats.bold} title="Bold (Ctrl+B)">
              <span style={{ fontFamily: "Georgia, serif", fontWeight: 800, fontSize: 14 }}>B</span>
            </Btn>
            <Btn onClick={onItalic} active={activeFormats.italic} title="Italic (Ctrl+I)">
              <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 14 }}>I</span>
            </Btn>
            <Btn onClick={onUnderline} active={activeFormats.underline} title="Underline (Ctrl+U)">
              <span className="underline text-[13px]">U</span>
            </Btn>
            <ColorPicker
              label="Font Color"
              color={activeFormats.color}
              colors={TEXT_COLORS}
              onChange={(c) => onTextColor?.(c)}
              trigger={
                <>
                  <span className="text-[13px] font-bold text-stone-700 leading-none" style={{ fontFamily: "Georgia, serif" }}>A</span>
                  <span className="w-4 h-[3px] rounded-full" style={{ background: activeFormats.color || "#1c1917" }} />
                </>
              }
            />
            <ColorPicker
              label="Highlight"
              colors={HIGHLIGHT_COLORS}
              onChange={(c) => onHighlight?.(c)}
              trigger={
                <>
                  <span className="text-[11px] leading-none">🖊</span>
                  <span className="w-4 h-[3px] rounded-full bg-yellow-300" />
                </>
              }
            />
          </div>
        </div>
      </Group>

      <Sep />

      {/* Paragraph: lists + indent on row 1, alignment on row 2 */}
      <Group label="Paragraph">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-0.5">
            <Btn onClick={onBullet}         title="Bullet List">    <BulletIcon /></Btn>
            <Btn onClick={onOrdered}        title="Numbered List">  <OrderedIcon /></Btn>
            <Btn onClick={onIndentDecrease} title="Decrease Indent"><IndDecIcon /></Btn>
            <Btn onClick={onIndentIncrease} title="Increase Indent"><IndIncIcon /></Btn>
          </div>
          <div className="flex items-center gap-0.5">
            <Btn onClick={onAlignLeft}   title="Align Left">   <AlignLIcon /></Btn>
            <Btn onClick={onAlignCenter} title="Center">       <AlignCIcon /></Btn>
            <Btn onClick={onAlignRight}  title="Align Right">  <AlignRIcon /></Btn>
            <Btn onClick={onJustify}     title="Justify">      <JustifyIcon /></Btn>
          </div>
        </div>
      </Group>

      <Sep />

      {/* Styles: heading previews */}
      <Group label="Styles">
        <Btn onClick={onHeading1} title="Heading 1">
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, letterSpacing: "-0.02em" }}>H1</span>
        </Btn>
        <Btn onClick={onHeading2} title="Heading 2">
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, letterSpacing: "-0.02em" }}>H2</span>
        </Btn>
      </Group>

      <Sep />

      {/* Insert */}
      <Group label="Insert">
        <Btn onClick={onHorizontalRule} title="Horizontal Rule"><HRIcon /></Btn>
      </Group>

      {/* Live badge */}
      <div className="ml-auto flex items-center flex-shrink-0">
        <div className="flex items-center gap-1.5 bg-orange-50 text-orange-600 text-[11px] font-semibold tracking-wide rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Live
        </div>
      </div>

    </div>
  );
};

export default Toolbar;