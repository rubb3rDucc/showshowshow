import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import type { Editor } from '@tiptap/react';

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e.isActive('bold'),
      isItalic: e.isActive('italic'),
      isStrike: e.isActive('strike'),
      isCode: e.isActive('code'),
      isH1: e.isActive('heading', { level: 1 }),
      isH2: e.isActive('heading', { level: 2 }),
      isH3: e.isActive('heading', { level: 3 }),
      isBulletList: e.isActive('bulletList'),
      isOrderedList: e.isActive('orderedList'),
      isBlockquote: e.isActive('blockquote'),
      isCodeBlock: e.isActive('codeBlock'),
    }),
  });

  const btn = (label: string, active: boolean, action: () => boolean) => (
    <button
      onClick={action}
      className={`px-2 py-1 text-sm rounded transition-colors ${
        active
          ? 'bg-[rgb(var(--color-accent))] text-white'
          : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-1 border-b border-[rgb(var(--color-border-default))] pb-2 mb-3">
      {btn('B', state.isBold, () => editor.chain().focus().toggleBold().run())}
      {btn('I', state.isItalic, () => editor.chain().focus().toggleItalic().run())}
      {btn('S', state.isStrike, () => editor.chain().focus().toggleStrike().run())}
      {btn('Code', state.isCode, () => editor.chain().focus().toggleCode().run())}

      <div className="w-px bg-[rgb(var(--color-border-default))] mx-1" />

      {btn('H1', state.isH1, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn('H2', state.isH2, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn('H3', state.isH3, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}

      <div className="w-px bg-[rgb(var(--color-border-default))] mx-1" />

      {btn('• List', state.isBulletList, () => editor.chain().focus().toggleList('bulletList', 'listItem').run())}
      {btn('1. List', state.isOrderedList, () => editor.chain().focus().toggleOrderedList().run())}
      {btn('" "', state.isBlockquote, () => editor.chain().focus().toggleBlockquote().run())}
      {btn('≡ Block', state.isCodeBlock, () => editor.chain().focus().toggleCodeBlock().run())}

    </div>
  );
}

export function Reviews() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Start writing...</p>',
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-6">Reviews</h1>

      <div className="border border-[rgb(var(--color-border-default))] rounded bg-[rgb(var(--color-bg-surface))] p-4 min-h-[400px]">
        {editor && <Toolbar editor={editor} />}

        {editor && (
          <BubbleMenu editor={editor}>
            <div className="flex gap-1 bg-[rgb(var(--color-bg-elevated))] border border-[rgb(var(--color-border-default))] rounded shadow-md p-1">
              <button
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
                className={`px-2 py-1 text-sm font-bold rounded ${editor.isActive('bold') ? 'bg-[rgb(var(--color-accent))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'}`}
              >
                B
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
                className={`px-2 py-1 text-sm italic rounded ${editor.isActive('italic') ? 'bg-[rgb(var(--color-accent))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'}`}
              >
                I
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
                className={`px-2 py-1 text-sm rounded ${editor.isActive('blockquote') ? 'bg-[rgb(var(--color-accent))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'}`}
              >
                "
              </button>
            </div>
          </BubbleMenu>
        )}

        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none text-[rgb(var(--color-text-primary))] focus:outline-none"
        />
      </div>
    </div>
  );
}
