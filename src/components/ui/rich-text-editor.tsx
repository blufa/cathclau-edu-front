"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Link as LinkIcon,
  Image as ImageIcon, Quote, Undo, Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/api/upload";
import { notifyError } from "@/lib/feedback";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/** Éditeur de contenu riche (WYSIWYG) pour la rédaction d'articles de blog : gras/italique/titres/
 * liens/images/listes. Produit et consomme du HTML brut (stocké tel quel côté backend). */
export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[220px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-gray-300 bg-white shadow-theme-xs", className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  async function handleImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadFile(file, "blog");
        editor.chain().focus().setImage({ src: url }).run();
      } catch (err) {
        notifyError(err);
      }
    };
    input.click();
  }

  function handleLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL du lien", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const items: { icon: React.ElementType; label: string; active?: boolean; onClick: () => void }[] = [
    { icon: Bold, label: "Gras", active: editor.isActive("bold"), onClick: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, label: "Italique", active: editor.isActive("italic"), onClick: () => editor.chain().focus().toggleItalic().run() },
    { icon: Heading2, label: "Titre H2", active: editor.isActive("heading", { level: 2 }), onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: "Titre H3", active: editor.isActive("heading", { level: 3 }), onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { icon: List, label: "Liste à puces", active: editor.isActive("bulletList"), onClick: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, label: "Liste numérotée", active: editor.isActive("orderedList"), onClick: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: Quote, label: "Citation", active: editor.isActive("blockquote"), onClick: () => editor.chain().focus().toggleBlockquote().run() },
    { icon: LinkIcon, label: "Lien", active: editor.isActive("link"), onClick: handleLink },
    { icon: ImageIcon, label: "Image", onClick: handleImage },
    { icon: Undo, label: "Annuler", onClick: () => editor.chain().focus().undo().run() },
    { icon: Redo, label: "Rétablir", onClick: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
      {items.map(({ icon: Icon, label, active, onClick }) => (
        <button
          key={label}
          type="button"
          title={label}
          onClick={onClick}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-200 hover:text-gray-900",
            active && "bg-brand-100 text-brand-700 hover:bg-brand-100",
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
