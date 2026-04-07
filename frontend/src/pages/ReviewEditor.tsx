import { useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontSize } from '@tiptap/extension-font-size';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Terminal, Undo, Redo, AArrowUp, AArrowDown,
  SeparatorHorizontal, ArrowLeft, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { useReviewEditor } from '../hooks/useReviewEditor';

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 48];
const DEFAULT_SIZE = 14;

function currentFontSize(editor: Editor): number {
  const val = editor.getAttributes('textStyle').fontSize as string | undefined;
  return val ? parseInt(val, 10) : DEFAULT_SIZE;
}

function Toolbar({ editor, onDelete }: { editor: Editor; onDelete: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e.isActive('bold'),
      isItalic: e.isActive('italic'),
      isStrike: e.isActive('strike'),
      isH1: e.isActive('heading', { level: 1 }),
      isH2: e.isActive('heading', { level: 2 }),
      isH3: e.isActive('heading', { level: 3 }),
      isBulletList: e.isActive('bulletList'),
      isOrderedList: e.isActive('orderedList'),
      isBlockquote: e.isActive('blockquote'),
      isCodeBlock: e.isActive('codeBlock'),
      fontSize: currentFontSize(e),
    }),
  });

  const btn = (icon: React.ReactNode, active: boolean, action: () => boolean, title: string) => (
    <button
      onClick={action}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-[rgb(var(--color-accent))] text-white'
          : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))] hover:text-[rgb(var(--color-text-primary))]'
      }`}
    >
      {icon}
    </button>
  );

  const sep = () => <div className="w-px h-5 bg-[rgb(var(--color-border-default))] mx-1 self-center" />;

  const changeFontSize = (direction: 'up' | 'down') => {
    const cur = state.fontSize;
    const idx = FONT_SIZES.indexOf(cur);
    let next: number;
    if (direction === 'up') {
      next = idx === -1 ? FONT_SIZES[FONT_SIZES.indexOf(DEFAULT_SIZE) + 1] : FONT_SIZES[Math.min(idx + 1, FONT_SIZES.length - 1)];
    } else {
      next = idx === -1 ? FONT_SIZES[FONT_SIZES.indexOf(DEFAULT_SIZE) - 1] : FONT_SIZES[Math.max(idx - 1, 0)];
    }
    editor.chain().focus().setFontSize(`${next}px`).run();
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 px-6 py-2 bg-[rgb(var(--color-bg-surface))] border-b border-[rgb(var(--color-border-subtle))]">
      <button
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
        className="p-1.5 rounded text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <Undo size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
        className="p-1.5 rounded text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <Redo size={16} />
      </button>

      {sep()}

      <button
        onClick={() => changeFontSize('down')}
        title="Decrease font size"
        className="p-1.5 rounded text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <AArrowDown size={16} />
      </button>
      <span className="text-xs text-[rgb(var(--color-text-secondary))] w-7 text-center tabular-nums">
        {state.fontSize}
      </span>
      <button
        onClick={() => changeFontSize('up')}
        title="Increase font size"
        className="p-1.5 rounded text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <AArrowUp size={16} />
      </button>

      {sep()}

      {btn(<Bold size={16} />, state.isBold, () => editor.chain().focus().toggleBold().run(), 'Bold')}
      {btn(<Italic size={16} />, state.isItalic, () => editor.chain().focus().toggleItalic().run(), 'Italic')}
      {btn(<Strikethrough size={16} />, state.isStrike, () => editor.chain().focus().toggleStrike().run(), 'Strikethrough')}
      {/* {btn(<Code size={16} />, state.isCode, () => editor.chain().focus().toggleCode().run(), 'Inline code')} */}

      {sep()}

      {btn(<Heading1 size={16} />, state.isH1, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1')}
      {btn(<Heading2 size={16} />, state.isH2, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2')}
      {btn(<Heading3 size={16} />, state.isH3, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Heading 3')}

      {sep()}

      {btn(<List size={16} />, state.isBulletList, () => editor.chain().focus().toggleList('bulletList', 'listItem').run(), 'Bullet list')}
      {btn(<ListOrdered size={16} />, state.isOrderedList, () => editor.chain().focus().toggleOrderedList().run(), 'Ordered list')}
      {btn(<Quote size={16} />, state.isBlockquote, () => editor.chain().focus().toggleBlockquote().run(), 'Blockquote')}
      {btn(<Terminal size={16} />, state.isCodeBlock, () => editor.chain().focus().toggleCodeBlock().run(), 'Code block')}

      {sep()}

      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
        className="p-1.5 rounded text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <SeparatorHorizontal size={16} />
      </button>

      <div className="flex-1" />

      <button
        onClick={onDelete}
        title="Delete review"
        className="p-1.5 rounded text-[rgb(var(--color-text-secondary))] hover:text-red-400 hover:bg-[rgb(var(--color-bg-elevated))] transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function ReviewEditor() {
  const [, params] = useRoute('/reviews/:id');
  const [, navigate] = useLocation();
  const id = params?.id ?? '';

  const {
    review, isLoading, displayTitle,
    showModified, setTitle, setBodyHtml, setShowModified,
    handleDelete, saveStatus,
  } = useReviewEditor(id, navigate);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-full prose-code:before:content-none prose-code:after:content-none prose-code:bg-[rgb(var(--color-bg-elevated))] prose-code:rounded prose-code:px-1 prose-code:font-mono prose-code:text-sm prose-pre:bg-[rgb(var(--color-bg-elevated))] prose-pre:text-[rgb(var(--color-text-primary))]',
      },
    },
    onUpdate: ({ editor: e }) => setBodyHtml(e.getHTML()),
  });

  // set editor content once review loads
  useEffect(() => {
    if (editor && review) {
      if (review.body && !editor.getText()) {
        editor.commands.setContent(review.body);
      }
      editor.commands.focus();
    }
  }, [editor, review]);

  if (isLoading) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {editor && <Toolbar editor={editor} onDelete={handleDelete} />}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-4 sm:py-10">
          {editor && (
            <BubbleMenu editor={editor}>
              <div className="flex gap-0.5 bg-[rgb(var(--color-bg-elevated))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-lg p-1">
                {/* bold bold bold */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
                  className={`p-1.5 rounded ${editor.isActive('bold') ? 'bg-[rgb(var(--color-accent))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'}`}
                >
                  <Bold size={14} />
                </button>
                {/* italics */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
                  className={`p-1.5 rounded ${editor.isActive('italic') ? 'bg-[rgb(var(--color-accent))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'}`}
                >
                  <Italic size={14} />
                </button>
                {/* underline */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
                  className={`p-1.5 rounded ${editor.isActive('strikethrough') ? 'bg-[rgb(var(--color-accent))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'}`}
                >
                  <Strikethrough size={14} />
                </button>
                {/* headings */}

                {/* <button
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
                  className={`p-1.5 rounded ${editor.isActive('blockquote') ? 'bg-[rgb(var(--color-accent))] text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]'}`}
                >
                  <Quote size={14} />
                </button> */}
              </div>
            </BubbleMenu>
          )}

          {/* Chrome: save status + back/delete + date */}
          <div className="flex flex-col gap-2 mb-4">
            <span className="text-xs text-[rgb(var(--color-text-secondary))] sm:hidden h-4">
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : '\u00A0'}
            </span>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/reviews')}
                className="p-1 -ml-1 rounded text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-bg-elevated))] transition-colors"
                title="Back to reviews"
              >
                <ArrowLeft size={18} />
              </button>

              {saveStatus === 'saving' && (
                <span className="hidden sm:inline text-xs text-[rgb(var(--color-text-secondary))]">Saving...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="hidden sm:inline text-xs text-[rgb(var(--color-text-secondary))]">Saved</span>
              )}

              <div className="flex-1" />

              {review && (
                <button
                  onClick={() => setShowModified(prev => !prev)}
                  className="text-sm text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
                  title={showModified ? 'Click to show created date' : 'Click to show modified date'}
                >
                  {showModified ? 'Edited:' : 'Created:'}
                  {" "}
                  {format(new Date(showModified ? review.updated_at : review.created_at), "MMMM d, yyyy 'at' pp")}
                </button>
              )}
            </div>
          </div>

          <textarea
            value={displayTitle}
            onChange={(e) => {
              setTitle(e.target.value)
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}`
            }}
            placeholder="Untitled"
            rows={1}
            className="w-full text-xl sm:text-2xl md:text-3xl font-bold bg-transparent border-none outline-none resize-none text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-secondary))] mb-6"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
