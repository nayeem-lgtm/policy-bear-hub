import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";

import { formatBytes, isImage } from "@/lib/company-chat";
import { signedAttachmentUrl } from "@/lib/messaging";

export function AttachmentCard({
  path,
  name,
  mime,
  size,
}: {
  path: string;
  name: string | null;
  mime: string | null;
  size: number | null;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void signedAttachmentUrl(path)
      .then((next) => {
        if (active) setUrl(next);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [path]);

  const label = name ?? "Attachment";

  if (isImage(mime)) {
    return (
      <a
        href={url ?? undefined}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 block w-fit overflow-hidden rounded-xl border border-border/70 bg-muted/40 shadow-sm transition hover:border-brand/40"
      >
        {url ? (
          <img src={url} alt={label} loading="lazy" className="max-h-72 max-w-sm object-cover" />
        ) : (
          <div className="h-40 w-64 animate-pulse bg-muted" />
        )}
        <span className="block border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          {label} · {formatBytes(size)}
        </span>
      </a>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer noopener"
      download={label}
      className="mt-2 inline-flex max-w-sm items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm transition hover:border-brand/40 hover:bg-muted/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">{label}</span>
        <span className="block text-[11px] text-muted-foreground">
          {formatBytes(size) || (mime ?? "File")}
        </span>
      </span>
      <Download className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  );
}
