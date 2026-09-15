import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, Send, Smile, X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { EMOJI_GROUPS, formatBytes, type StaffProfile } from "@/lib/company-chat";
import { cn } from "@/lib/utils";

export interface ComposerHandleSend {
  (body: string, files: File[]): Promise<void>;
}

export function ChatComposer({
  staff,
  onSend,
  placeholder,
  files,
  setFiles,
  compact,
  autoFocus,
  onTyping,
}: {
  staff: StaffProfile[];
  onSend: ComposerHandleSend;
  placeholder: string;
  files: File[];
  setFiles: (next: File[]) => void;
  compact?: boolean | undefined;
  autoFocus?: boolean | undefined;
  onTyping?: (() => void) | undefined;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return staff.filter((person) => person.name.toLowerCase().includes(query)).slice(0, 6);
  }, [mentionQuery, staff]);

  function syncMentionQuery(next: string, caret: number) {
    const upToCaret = next.slice(0, caret);
    const match = /(?:^|\s)@([\p{L}\p{N} .'-]{0,24})$/u.exec(upToCaret);
    if (!match) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(match[1] ?? "");
    setMentionIndex(0);
  }

  function applyMention(person: StaffProfile) {
    const node = textareaRef.current;
    const caret = node?.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const start = upToCaret.lastIndexOf("@");
    if (start < 0) return;
    const next = `${value.slice(0, start)}@${person.name} ${value.slice(caret)}`;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      node?.focus();
      const position = start + person.name.length + 2;
      node?.setSelectionRange(position, position);
    });
  }

  function insertEmoji(emoji: string) {
    const node = textareaRef.current;
    const caret = node?.selectionStart ?? value.length;
    const next = `${value.slice(0, caret)}${emoji}${value.slice(caret)}`;
    setValue(next);
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(caret + emoji.length, caret + emoji.length);
    });
  }

  async function submit() {
    if (sending) return;
    if (!value.trim() && files.length === 0) return;
    setSending(true);
    try {
      await onSend(value.trim(), files);
      setValue("");
      setFiles([]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  return (
    <div className="relative">
      {mentionQuery !== null && mentionMatches.length > 0 && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-72 overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg">
          <p className="border-b border-border/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Mention a teammate
          </p>
          {mentionMatches.map((person, index) => (
            <button
              key={person.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                applyMention(person);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]",
                index === mentionIndex ? "bg-brand/10 text-brand" : "hover:bg-muted/60",
              )}
            >
              <Avatar className="h-6 w-6">
                {person.avatar_url && <AvatarImage src={person.avatar_url} alt={person.name} />}
                <AvatarFallback className="text-[10px]">{person.avatar_initials}</AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{person.name}</span>
              <span className="ml-auto truncate text-[11px] text-muted-foreground">{person.title || person.department}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl border border-border/70 bg-card shadow-card transition focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/15",
          compact ? "p-2" : "p-2.5",
        )}
      >
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex max-w-[220px] items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-2 py-1 text-[11px]"
              >
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={value}
          rows={compact ? 1 : 2}
          placeholder={placeholder}
          onChange={(event) => {
            setValue(event.target.value);
            onTyping?.();
            syncMentionQuery(event.target.value, event.target.selectionStart ?? 0);
          }}
          onPaste={(event) => {
            const pasted = Array.from(event.clipboardData?.files ?? []);
            if (pasted.length > 0) {
              event.preventDefault();
              setFiles([...files, ...pasted]);
            }
          }}
          onKeyDown={(event) => {
            if (mentionQuery !== null && mentionMatches.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMentionIndex((index) => (index + 1) % mentionMatches.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setMentionIndex((index) => (index - 1 + mentionMatches.length) % mentionMatches.length);
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                const person = mentionMatches[mentionIndex];
                if (person) applyMention(person);
                return;
              }
              if (event.key === "Escape") {
                setMentionQuery(null);
                return;
              }
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          className="min-h-0 resize-none border-0 bg-transparent px-2 py-1.5 text-[13.5px] shadow-none focus-visible:ring-0"
        />

        <div className="mt-1 flex items-center gap-1 px-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              if (picked.length > 0) setFiles([...files, ...picked]);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-brand"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-brand"
                aria-label="Insert emoji"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <div className="space-y-3">
                {EMOJI_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-8 gap-1">
                      {group.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className="grid h-7 w-7 place-items-center rounded-md text-[15px] transition hover:bg-muted"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <span className="ml-1 hidden text-[11px] text-muted-foreground sm:block">
            Enter to send · Shift + Enter for a new line · @ to mention
          </span>

          <Button
            type="button"
            size="sm"
            className="ml-auto h-8 gap-1.5 rounded-lg px-3"
            disabled={sending || (!value.trim() && files.length === 0)}
            onClick={() => void submit()}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
