import { tokenizeBody } from "@/lib/company-chat";

export function MessageBody({
  body,
  names,
  myName,
}: {
  body: string;
  names: string[];
  myName?: string | undefined;
}) {
  if (!body.trim()) return null;
  const tokens = tokenizeBody(body, names, myName);
  return (
    <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground/90">
      {tokens.map((token, index) => {
        if (token.type === "mention") {
          return (
            <span
              key={index}
              className={
                token.isMe
                  ? "rounded-md bg-brand-cyan/20 px-1 font-semibold text-brand"
                  : "rounded-md bg-brand/10 px-1 font-semibold text-brand"
              }
            >
              {token.value}
            </span>
          );
        }
        if (token.type === "link") {
          return (
            <a
              key={index}
              href={token.value}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
            >
              {token.value}
            </a>
          );
        }
        if (token.type === "code") {
          return (
            <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">
              {token.value}
            </code>
          );
        }
        if (token.type === "bold") {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {token.value}
            </strong>
          );
        }
        return <span key={index}>{token.value}</span>;
      })}
    </p>
  );
}
