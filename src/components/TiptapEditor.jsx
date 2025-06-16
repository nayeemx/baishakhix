import React, { useRef, useState, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import Highlight from "@tiptap/extension-highlight";
import Mention from "@tiptap/extension-mention";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaCode,
  FaHighlighter,
  FaLink,
  FaListUl,
  FaListOl,
  FaHeading,
  FaImage,
  FaTable,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaAlignJustify,
  FaEraser,
  FaQuoteRight,
  FaMinus,
  FaUndo,
  FaRedo,
  FaFont,
} from "react-icons/fa";

const headingLevels = [
  { label: "Paragraph", value: 0 },
  { label: "Heading 1", value: 1 },
  { label: "Heading 2", value: 2 },
  { label: "Heading 3", value: 3 },
  { label: "Heading 4", value: 4 },
  { label: "Heading 5", value: 5 },
  { label: "Heading 6", value: 6 },
];

const TiptapEditor = ({ content, onChange }) => {
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [tableAlign, setTableAlign] = useState("left");
  const [tableWidth, setTableWidth] = useState("full"); // "full" or "small"
  const [heading, setHeading] = useState(0);
  const [lintErrors, setLintErrors] = useState([]);
  const [checking, setChecking] = useState(false);
  const [tableHeader, setTableHeader] = useState(true);
  const [tableBorder, setTableBorder] = useState(true);
  const [tableBorderSides, setTableBorderSides] = useState("all"); // all, top, right, bottom, left, none
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [fontColor, setFontColor] = useState("#22223b");

  // Allow mention to accept any text (e.g., news link, site, etc.)
  // No suggestion list, just insert what user types after '@'
  const editor = useEditor({
    extensions: [
      TextStyle,
      Color,
      StarterKit,
      Image,
      Underline,
      Strike,
      Code,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: true,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention bg-blue-100 text-blue-800 px-1 rounded",
        },
        suggestion: {
          items: ({ query }) => {
            if (!query) return [];
            return [{ id: query, label: query }];
          },
          render: () => {
            let component;
            let popup;
            return {
              onStart: (props) => {
                component = document.createElement("div");
                component.className =
                  "mention-list bg-white border rounded shadow p-1";
                popup = document.createElement("div");
                popup.appendChild(component);
                document.body.appendChild(popup);
                update(props);
              },
              onUpdate: (props) => update(props),
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  popup.remove();
                  return true;
                }
                return false;
              },
              onExit: () => {
                if (popup) popup.remove();
              },
            };

            function update(props) {
              if (!component) return;
              component.innerHTML = "";
              props.items.forEach((item, idx) => {
                const el = document.createElement("div");
                el.className =
                  "mention-item px-2 py-1 cursor-pointer hover:bg-blue-200" +
                  (idx === props.selected ? " bg-blue-100" : "");
                el.textContent = item.label;
                el.onclick = () => props.command(item);
                component.appendChild(el);
              });
              const { left, top } = props.clientRect();
              popup.style.position = "absolute";
              popup.style.left = left + "px";
              popup.style.top = top + "px";
              popup.style.zIndex = 9999;
            }
          },
        },
        allowedChars: /^[\S ]+$/,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell.configure({
        HTMLAttributes: {
          class: "p-2 border",
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-headings:font-ibm max-w-none min-h-[400px] focus:outline-none text-base cursor-text",
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          const editorDom = view.dom;
          const isInsideEditor = editorDom.contains(event.target);
          if (!isInsideEditor) {
            view.focus();
            return false;
          }
        },
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) onChange(editor.getHTML());
    },
  });

  const fileInputRef = useRef(null);

  const onImageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const base64 = readerEvent.target.result;
        editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
    }
    event.target.value = null;
  };

  // Track heading for dropdown (sync with editor)
  React.useEffect(() => {
    if (!editor) return;
    const updateHeading = () => {
      const level =
        headingLevels.find((h) => h.value !== 0 && editor.isActive("heading", { level: h.value }))?.value || 0;
      setHeading(level);
    };
    editor.on("selectionUpdate", updateHeading);
    editor.on("transaction", updateHeading);
    return () => {
      editor.off("selectionUpdate", updateHeading);
      editor.off("transaction", updateHeading);
    };
  }, [editor]);

  // Clear all content and images
  const handleClear = () => {
    editor.commands.clearContent();
    if (onChange) onChange("");
  };

  const handleHeadingChange = (e) => {
    const level = Number(e.target.value);
    setHeading(level);
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
  };

  const handleTableInsert = () => {
    editor
      .chain()
      .focus()
      .insertTable({
        rows: tableRows,
        cols: tableCols,
        withHeaderRow: tableHeader,
      })
      .run();
    setShowTableDialog(false);
    setTimeout(() => {
      const tables = document.querySelectorAll(".ProseMirror table");
      if (tables.length > 0) {
        const tableDOM = tables[tables.length - 1];
        // Remove any previous width classes
        tableDOM.classList.remove("table-full-width", "table-small-width");
        if (tableWidth === "small") {
          tableDOM.classList.add("table-small-width");
        } else {
          tableDOM.classList.add("table-full-width");
        }
        if (tableAlign !== "left") {
          tableDOM.style.marginLeft = tableAlign === "center" ? "auto" : "";
          tableDOM.style.marginRight = tableAlign === "center" ? "auto" : "";
          if (tableAlign === "right") {
            tableDOM.style.marginLeft = "auto";
            tableDOM.style.marginRight = "0";
          }
        } else {
          tableDOM.style.marginLeft = "";
          tableDOM.style.marginRight = "";
        }
        // Border logic
        if (tableBorder) {
          let borderStyle = `1.5px solid #000`; // always black
          tableDOM.style.borderCollapse = "collapse";
          tableDOM.style.border = tableBorderSides === "all" ? borderStyle : "none";
          // Remove all borders first
          tableDOM.style.borderTop = "none";
          tableDOM.style.borderRight = "none";
          tableDOM.style.borderBottom = "none";
          tableDOM.style.borderLeft = "none";
          // Set selected sides
          if (tableBorderSides === "all") {
            tableDOM.style.border = borderStyle;
          } else {
            if (tableBorderSides === "top") tableDOM.style.borderTop = borderStyle;
            if (tableBorderSides === "right") tableDOM.style.borderRight = borderStyle;
            if (tableBorderSides === "bottom") tableDOM.style.borderBottom = borderStyle;
            if (tableBorderSides === "left") tableDOM.style.borderLeft = borderStyle;
          }
        } else {
          tableDOM.style.border = "none";
          tableDOM.style.borderTop = "none";
          tableDOM.style.borderRight = "none";
          tableDOM.style.borderBottom = "none";
          tableDOM.style.borderLeft = "none";
        }
      }
    }, 150);
  };

  // Add hyperlink handler
  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // Linting function using LanguageTool public API
  const checkSpelling = async (text) => {
    setChecking(true);
    setLintErrors([]);
    try {
      const res = await fetch("https://api.languagetoolplus.com/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          text,
          language: "en-US",
        }),
      });
      const data = await res.json();
      setLintErrors(data.matches || []);
    } catch (e) {
      // Ignore errors
    }
    setChecking(false);
  };

  // Run linting on content change
  useEffect(() => {
    if (!editor) return;
    const plainText = editor.getText();
    if (plainText.trim().length > 0) {
      checkSpelling(plainText);
    } else {
      setLintErrors([]);
    }
    // eslint-disable-next-line
  }, [editor && editor.getText()]);

  // Update table border color in DOM when tableBorderColor changes
  useEffect(() => {
    if (!editor) return;
    const tables = document.querySelectorAll(".ProseMirror table");
    if (tables.length === 0) return;
    const tableDOM = tables[tables.length - 1];
    tableDOM.style.setProperty("border-collapse", "collapse");
    tableDOM.style.border = "";
    tableDOM.style.borderTop = "";
    tableDOM.style.borderRight = "";
    tableDOM.style.borderBottom = "";
    tableDOM.style.borderLeft = "";
    tableDOM.querySelectorAll("th,td").forEach(cell => {
      cell.style.borderColor = "";
    });

    if (tableBorder) {
      if (tableBorderSides === "all") {
        const color = "#000";
        tableDOM.style.border = `1.5px solid ${color}`;
        tableDOM.style.borderTop = `1.5px solid ${color}`;
        tableDOM.style.borderRight = `1.5px solid ${color}`;
        tableDOM.style.borderBottom = `1.5px solid ${color}`;
        tableDOM.style.borderLeft = `1.5px solid ${color}`;
        tableDOM.querySelectorAll("th,td").forEach(cell => {
          cell.style.borderColor = color;
        });
      } else {
        const color = "#000";
        if (tableBorderSides === "top") tableDOM.style.borderTop = `1.5px solid ${color}`;
        if (tableBorderSides === "right") tableDOM.style.borderRight = `1.5px solid ${color}`;
        if (tableBorderSides === "bottom") tableDOM.style.borderBottom = `1.5px solid ${color}`;
        if (tableBorderSides === "left") tableDOM.style.borderLeft = `1.5px solid ${color}`;
      }
    } else {
      tableDOM.style.border = "none";
      tableDOM.style.borderTop = "none";
      tableDOM.style.borderRight = "none";
      tableDOM.style.borderBottom = "none";
      tableDOM.style.borderLeft = "none";
      tableDOM.querySelectorAll("th,td").forEach(cell => {
        cell.style.borderColor = "";
      });
    }
  }, [tableBorder, tableBorderSides, editor]);

  if (!editor) return null;

  return (
    <div className="w-full p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex flex-wrap gap-2 border-b pb-2 mb-4 text-sm text-gray-600 items-center">
        <button
          type="button"
          title="Bold"
          className={`px-2 py-1 border rounded hover:bg-gray-200${
            editor.isActive("bold") ? " font-bold text-black" : ""
          }`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <FaBold />
        </button>
        <button
          type="button"
          title="Italic"
          className={`px-2 py-1 border rounded hover:bg-gray-200${
            editor.isActive("italic") ? " italic text-black" : ""
          }`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <FaItalic />
        </button>
        <button
          type="button"
          title="Underline"
          className={`px-2 py-1 border rounded hover:bg-gray-200${
            editor.isActive("underline") ? " underline text-black" : ""
          }`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <FaUnderline />
        </button>
        <button
          type="button"
          title="Strikethrough"
          className={`px-2 py-1 border rounded hover:bg-gray-200${
            editor.isActive("strike") ? " line-through text-black" : ""
          }`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Strikethrough"
        >
          <FaStrikethrough />
        </button>

        {/* Font Color */}
        <label
          title="Font Color"
          className="px-2 py-1 border rounded hover:bg-gray-200 cursor-pointer flex items-center"
          style={{ position: "relative", display: "inline-flex" }}
          aria-label="Font Color"
        >
          <FaFont
            style={{
              color: editor?.getAttributes("textStyle")?.color || "#22223b",
              pointerEvents: "none",
            }}
          />
          <input
            type="color"
            value={fontColor}
            onChange={e => {
              setFontColor(e.target.value);
              editor.chain().focus().setColor(e.target.value).run();
            }}
            style={{
              opacity: 0,
              width: 24,
              height: 24,
              position: "absolute",
              left: 0,
              top: 0,
              cursor: "pointer",
            }}
            tabIndex={-1}
            aria-label="Pick font color"
          />
        </label>

        {/* Text align */}
        <button
          type="button"
          title="Align Left"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          aria-label="Align Left"
        >
          <FaAlignLeft />
        </button>
        <button
          type="button"
          title="Align Center"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          aria-label="Align Center"
        >
          <FaAlignCenter />
        </button>
        <button
          type="button"
          title="Align Right"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          aria-label="Align Right"
        >
          <FaAlignRight />
        </button>
        <button
          type="button"
          title="Align Justify"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          aria-label="Align Justify"
        >
          <FaAlignJustify />
        </button>
        
        <button
          type="button"
          title="Inline Code"
          className={`px-2 py-1 border rounded hover:bg-gray-200${
            editor.isActive("code") ? " bg-gray-200 text-black" : ""
          }`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          aria-label="Code"
        >
          <FaCode />
        </button>
        <button
          type="button"
          title="Highlight"
          className={`px-2 py-1 border rounded hover:bg-yellow-200${
            editor.isActive("highlight") ? " bg-yellow-200 text-black" : ""
          }`}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          aria-label="Highlight"
        >
          <FaHighlighter />
        </button>
        <button
          type="button"
          title="Hyperlink"
          className={`px-2 py-1 border rounded hover:bg-gray-200${
            editor.isActive("link") ? " text-blue-600 underline" : ""
          }`}
          onClick={setLink}
          aria-label="Link"
        >
          <FaLink />
        </button>
        <button
          type="button"
          title="Bullet List"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet List"
        >
          <FaListUl />
        </button>
        <button
          type="button"
          title="Ordered List"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Ordered List"
        >
          <FaListOl />
        </button>
        {/* Indent/Outdent for sublists */}
        <button
          type="button"
          title="Indent"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => {
            if (editor.isActive("listItem")) {
              editor.chain().focus().sinkListItem("listItem").run();
            } else {
              const { state, dispatch } = editor.view;
              const { $from } = state.selection;
              const pos = $from.start();
              dispatch(state.tr.insertText("    ", pos)); // 4 spaces for one tab
              editor.commands.focus();
            }
          }}
          aria-label="Indent"
        >
          ➡️
        </button>
        <button
          type="button"
          title="Outdent"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => {
            if (editor.isActive("listItem")) {
              editor.chain().focus().liftListItem("listItem").run();
            } else {
              const { state, dispatch } = editor.view;
              const { $from } = state.selection;
              const pos = $from.start();
              const node = state.doc.nodeAt(pos);
              if (node && node.text && node.text.startsWith("    ")) {
                dispatch(state.tr.delete(pos, pos + 4));
              } else if (node && node.text && node.text.startsWith("   ")) {
                dispatch(state.tr.delete(pos, pos + 3));
              } else if (node && node.text && node.text.startsWith("  ")) {
                dispatch(state.tr.delete(pos, pos + 2));
              } else if (node && node.text && node.text.startsWith(" ")) {
                dispatch(state.tr.delete(pos, pos + 1));
              }
              editor.commands.focus();
            }
          }}
          aria-label="Outdent"
        >
          ⬅️
        </button>
        {/* Heading dropdown */}
        <select
          className="px-2 py-1 border rounded"
          value={heading}
          onChange={handleHeadingChange}
          aria-label="Heading"
          title="Heading"
        >
          {headingLevels.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        
        {/* Image upload */}
        <button
          type="button"
          title="Insert Image"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={onImageUpload}
          aria-label="Upload Image"
        >
          <FaImage />
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        {/* Table insert with dialog */}
        <button
          type="button"
          title="Insert Table"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => setShowTableDialog(true)}
          aria-label="Insert Table"
        >
          <FaTable />
        </button>
        
        <button
          type="button"
          title="Blockquote"
          className={`px-2 py-1 border rounded hover:bg-gray-200${
            editor.isActive("blockquote") ? " bg-gray-200" : ""
          }`}
          onClick={() => {
            // If already in blockquote, exit by setting paragraph
            if (editor.isActive("blockquote")) {
              editor.chain().focus().lift("blockquote").run() ||
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleBlockquote().run();
            }
          }}
          aria-label="Blockquote"
        >
          <FaQuoteRight />
        </button>
        <button
          type="button"
          title="Horizontal Rule"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          aria-label="Horizontal Rule"
        >
          <FaMinus />
        </button>

        <button
          type="button"
          title="Task List"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          aria-label="Task List"
        >
          {/* You can use a checkbox icon here if you want */}
          <span style={{ fontWeight: "bold" }}>☑️</span>
        </button>

        {/* Undo/Redo buttons */}
        <button
          type="button"
          title="Undo"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().undo().run()}
          aria-label="Undo"
        >
          <FaUndo />
        </button>
        <button
          type="button"
          title="Redo"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={() => editor.chain().focus().redo().run()}
          aria-label="Redo"
        >
          <FaRedo />
        </button>

        {/* Clear button */}
        <button
          type="button"
          title="Clear All"
          className="px-2 py-1 border rounded hover:bg-gray-200"
          onClick={handleClear}
          aria-label="Clear"
        >
          <FaEraser />
        </button>
      </div>
      {/* Table dialog */}
      {showTableDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg flex flex-col gap-4 min-w-[300px]">
            <div>
              <label className="block mb-1">Rows</label>
              <input
                type="number"
                min={1}
                max={10}
                value={tableRows}
                onChange={(e) => setTableRows(Number(e.target.value))}
                className="border rounded p-1 w-full"
              />
            </div>
            <div>
              <label className="block mb-1">Columns</label>
              <input
                type="number"
                min={1}
                max={10}
                value={tableCols}
                onChange={(e) => setTableCols(Number(e.target.value))}
                className="border rounded p-1 w-full"
              />
            </div>
            <div>
              <label className="block mb-1">Table Alignment</label>
              <select
                value={tableAlign}
                onChange={(e) => setTableAlign(e.target.value)}
                className="border rounded p-1 w-full"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <label className="block mb-1">Table Width</label>
              <select
                value={tableWidth}
                onChange={(e) => setTableWidth(e.target.value)}
                className="border rounded p-1 w-full"
              >
                <option value="full">Full Width</option>
                <option value="small">Small Width</option>
              </select>
            </div>
            <div>
              <label className="block mb-1">Include Header Row</label>
              <input
                type="checkbox"
                checked={tableHeader}
                onChange={e => setTableHeader(e.target.checked)}
                className="mr-2"
              />
              <span>{tableHeader ? "Yes" : "No"}</span>
            </div>
            <div>
              <label className="block mb-1">Table Border</label>
              <input
                type="checkbox"
                checked={tableBorder}
                onChange={e => setTableBorder(e.target.checked)}
                className="mr-2"
              />
              <span>{tableBorder ? "Show" : "Hide"}</span>
            </div>
            {tableBorder && (
              <>
                <div>
                  <label className="block mb-1">Border Sides</label>
                  <select
                    value={tableBorderSides}
                    onChange={e => setTableBorderSides(e.target.value)}
                    className="border rounded p-1 w-full"
                  >
                    <option value="all">All</option>
                    <option value="top">Top</option>
                    <option value="right">Right</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                  </select>
                </div>
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-1 bg-blue-600 text-white rounded"
                onClick={handleTableInsert}
              >
                Insert
              </button>
              <button
                type="button"
                className="px-3 py-1 bg-gray-300 rounded"
                onClick={() => setShowTableDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-full">
        <div
          className="relative"
          style={{
            minHeight: 400,
            fontFamily: "'IBM Plex Sans', Arial, sans-serif",
            fontSize: 18,
            padding: 0,
            background: "#f9fafb",
            borderRadius: 8,
          }}
          onClick={(e) => {
            if (editor) editor.commands.focus();
          }}
        >
          <EditorContent
            editor={editor}
            className="prose prose-headings:font-ibm max-w-none min-h-[400px] focus:outline-none text-base ProseMirror"
            style={{
              minHeight: 400,
              fontFamily: "'IBM Plex Sans', Arial, sans-serif",
              fontSize: 18,
              padding: 16,
              background: "transparent",
              borderRadius: 8,
              cursor: "text",
            }}
            spellCheck={true}
            lang="en"
            autoCorrect="on"
            autoCapitalize="on"
          />
          {/* Placeholder only if empty and not focused */}
          {(!editor.isFocused && editor.getText().trim() === "") && (
            <div
              className="pointer-events-none absolute left-8 top-8"
              style={{
                color: "#b91c1c",
                fontFamily: "'IBM Plex Sans', Arial, sans-serif",
                fontWeight: 700,
                fontSize: 18,
                opacity: 0.7,
                letterSpacing: "0.05em",
                zIndex: 1,
                background: "transparent",
                userSelect: "none",
              }}
            >
               <span>Click here and start typing...</span>
            </div>
          )}
        </div>
        {/* Linting results */}
        <div className="mt-2">
          {checking && <span className="text-gray-500">Checking...</span>}
          {!checking && lintErrors.length > 0 && (
            <ul className="text-red-600 text-sm">
              {lintErrors.map((err, idx) => (
                <li key={idx}>
                  {err.message}{" "}
                  {err.replacements && err.replacements.length > 0 && (
                    <span>
                      (Suggestions:{" "}
                      {err.replacements.slice(0, 3).map(r => r.value).join(", ")}
                      {err.replacements.length > 3 ? ", ..." : ""}
                      )
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700&display=swap');
          .prose, .prose * {
            font-family: 'IBM Plex Sans', Arial, sans-serif !important;
          }
          .prose h1 { font-size: 2.25rem !important; font-weight: 700; margin-top: 1.5rem; margin-bottom: 1rem; }
          .prose h2 { font-size: 1.5rem !important; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.75rem; }
          .prose h3 { font-size: 1.25rem !important; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; }
          .prose h4 { font-size: 1.125rem !important; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.5rem; }
          .prose h5 { font-size: 1rem !important; font-weight: 600; margin-top: 0.5rem; margin-bottom: 0.25rem; }
          .prose h6 { font-size: 0.875rem !important; font-weight: 600; margin-top: 0.25rem; margin-bottom: 0.25rem; }
          .prose blockquote, .ProseMirror blockquote {
            border-left: 4px solid #b91c1c;
            margin: 1em 0;
            padding: 0.5em 1em;
            color: #374151;
            background: #f3f4f6;
            font-style: italic;
            border-radius: 0.25em;
          }
          .prose hr, .ProseMirror hr {
            border: none;
            border-top: 2px solid #b91c1c;
            margin: 1.5em 0;
          }
          .prose table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5em 0;
            background: #f8fafc;
            border-radius: 0.5em;
            overflow: hidden;
            box-shadow: 0 2px 8px 0 #e0e7ef;
          }
          .prose th, .ProseMirror th {
            background: #2f9ae1 !important;
            color: #fff !important;
            font-weight: 700 !important;
            padding: 0.75em 1em !important;
            border-bottom: 2px solid #0369a1;
            border-right: 1px solid #e5e7eb;
            text-align: left;
            letter-spacing: 0.02em;
          }
          .prose tr:last-child th, .ProseMirror tr:last-child th {
            border-bottom: none !important;
          }
          .prose td, .ProseMirror td {
            background: #f1f5f9;
            color: #0f172a;
            padding: 0.75em 1em !important;
            border-bottom: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            font-size: 1em;
            transition: background 0.15s;
          }
          .prose tr:nth-child(even) td, .ProseMirror tr:nth-child(even) td {
            background: #e0f2fe;
          }
          .prose tr:last-child td, .ProseMirror tr:last-child td {
            border-bottom: none;
          }
          .prose th:last-child, .prose td:last-child,
          .ProseMirror th:last-child, .ProseMirror td:last-child {
            border-right: none;
          }
          .prose th, .prose td, .ProseMirror th, .ProseMirror td {
            border-left: none;
            vertical-align: middle;
          }
          .prose th:first-child, .prose td:first-child,
          .ProseMirror th:first-child, .ProseMirror td:first-child {
            border-left: none;
          }
          .prose th, .prose td, .ProseMirror th, .ProseMirror td {
            vertical-align: middle;
          }
          .prose table, .ProseMirror table {
            box-shadow: 0 2px 8px 0 #ede9fe;
          }
          /* Table width classes (raw CSS) */
          .ProseMirror table.table-small-width {
            width: 50%;
            min-width: 200px;
            max-width: 600px;
          }
          .ProseMirror table.table-full-width {
            width: 100%;
            min-width: unset;
            max-width: unset;
          }
          /* Remove custom-table-border and variable logic */
          /* Show disk for unordered list and numbers for ordered list */
          .prose ul, .ProseMirror ul {
            list-style-type: disc !important;
            margin-left: 2em !important;
          }
          .prose ol, .ProseMirror ol {
            list-style-type: decimal !important;
            margin-left: 2em !important;
          }
          .prose ul li, .ProseMirror ul li {
            position: relative;
            padding-left: 0.5em;
          }
          .prose ol li, .ProseMirror ol li {
            position: relative;
            padding-left: 0.5em;
          }

          /* --- Task List Styling --- */
          .prose ul[data-type="taskList"],
          .ProseMirror ul[data-type="taskList"] {
            list-style: none !important;
            padding-left: 0;
            margin-left: 0;
          }
          .prose ul[data-type="taskList"] li,
          .ProseMirror ul[data-type="taskList"] li {
            list-style: none !important;
            margin-left: 0 !important;
            padding-left: 0 !important;
            display: flex !important;
            align-items: center !important;
            gap: 0.5em !important;
          }
          .prose li[data-type="taskItem"],
          .ProseMirror li[data-type="taskItem"] {
            display: flex !important;
            align-items: center !important;
            gap: 0.5em !important;
            padding: 0.25em 0.5em;
            border-radius: 6px;
            margin-bottom: 2px;
            transition: background 0.15s;
            background: none;
            position: relative;
            /* Remove vertical-align and inline for p */
          }
          .prose li[data-type="taskItem"]:hover,
          .ProseMirror li[data-type="taskItem"]:hover {
            background: #f3f4f6;
          }
          .prose li[data-type="taskItem"] input[type="checkbox"],
          .ProseMirror li[data-type="taskItem"] input[type="checkbox"] {
            margin-right: 0.5em;
            accent-color: #7c3aed;
            width: 1.1em;
            height: 1.1em;
            border-radius: 4px;
            border: 2px solid #7c3aed;
            background: #fff;
            transition: box-shadow 0.1s;
            box-shadow: 0 0 0 1.5px #7c3aed;
            cursor: pointer;
            flex-shrink: 0;
            display: inline-block;
          }
          .prose li[data-type="taskItem"] p,
          .ProseMirror li[data-type="taskItem"] p {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            font-size: 1em;
            font-weight: 500;
            color: #22223b;
          }
          .prose li[data-type="taskItem"] input[type="checkbox"]:checked,
          .ProseMirror li[data-type="taskItem"] input[type="checkbox"]:checked {
            background: #7c3aed;
            border-color: #7c3aed;
            box-shadow: 0 0 0 2px #7c3aed;
          }
          .prose li[data-type="taskItem"].is-checked p,
          .ProseMirror li[data-type="taskItem"].is-checked p {
            color: #888;
            text-decoration: line-through;
          }
        `}
      </style>
    </div>
  );
};

export default TiptapEditor;