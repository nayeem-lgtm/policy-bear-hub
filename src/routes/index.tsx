import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PolicyBearMark } from "@/components/brand/PolicyBearLogo";
import { useAuth } from "@/context/AuthContext";
import brandLogo from "@/assets/policybear-brand-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Policy Bear Operations CRM" },
      {
        name: "description",
        content:
          "Secure sign-in for the Policy Bear Operations CRM: shift control, sales pipeline, quoting, quality control and training in one workspace.",
      },
      { property: "og:title", content: "Sign in — Policy Bear Operations CRM" },
      {
        property: "og:description",
        content:
          "Secure sign-in for the Policy Bear Operations CRM: shift control, sales pipeline, quoting, quality control and training in one workspace.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, ready, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (ready && user) void navigate({ to: user.landing, replace: true });
  }, [ready, user, navigate]);

  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Browser autofill can populate the inputs without firing React onChange,
    // so read the live form values as the source of truth.
    const form = new FormData(e.currentTarget);
    const emailValue = String(form.get("email") ?? email).trim();
    const passwordValue = String(form.get("password") ?? password);

    if (!emailValue || !passwordValue) {
      setError("Enter your work email and password.");
      return;
    }

    setBusy(true);
    const result = await signIn(emailValue, passwordValue);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Sign in failed.");
      return;
    }
    setError(null);
    void navigate({ to: result.user?.landing ?? "/dashboard", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-white bg-white shadow-[0_32px_64px_-12px_oklch(0.227_0.086_281_/_0.16)] md:min-h-[620px] lg:h-[660px] lg:flex-row">
        {/* Left hero panel */}
        <section className="login-hero relative hidden flex-1 overflow-hidden bg-brand-ink px-10 py-10 md:flex md:flex-col">
          <div className="auth-grid absolute inset-0" aria-hidden="true" />

          {/* Ambient glows */}
          <div
            className="pointer-events-none absolute -top-[12%] -right-[12%] size-[26rem] rounded-full bg-brand/25 blur-[110px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-[12%] -left-[12%] size-[22rem] rounded-full bg-brand-cyan/15 blur-[100px]"
            aria-hidden="true"
          />

          {/* Top-left wordmark */}
          <div className="relative z-10 self-start">
            <img
              src={brandLogo.url}
              alt="PolicyBear"
              className="h-8 w-auto object-contain brightness-0 invert"
            />
          </div>

          <div className="relative z-10 my-auto flex w-full flex-col items-center justify-center py-8">
            {/* Protection orbit scene */}
            <div className="auth-reveal auth-delay-1 relative grid h-[18rem] w-full max-w-lg place-items-center">
              {/* Concentric rotating rings */}
              <div className="orbit-spin absolute size-72 rounded-full border border-brand-ink-foreground/10" />
              <div className="orbit-spin-rev absolute size-56 rounded-full border border-brand-cyan/20" />
              <div className="orbit-spin-slow absolute size-80 rounded-full border border-brand-ink-foreground/5" />

              {/* Radar sweep */}
              <div className="radar-sweep absolute size-72 rounded-full" />

              {/* Orbiting beacon */}
              <div className="orbit-node absolute size-72" aria-hidden="true">
                <span className="absolute -top-1 left-1/2 -ml-1 size-2 rounded-full bg-brand-cyan shadow-[0_0_14px_4px_oklch(0.845_0.106_218_/_0.65)]" />
              </div>

              {/* Central shield */}
              <div className="relative grid size-28 place-items-center overflow-hidden rounded-[1.6rem] border border-brand-cyan/25 bg-white/10 shadow-brand backdrop-blur-xl">
                <div
                  className="absolute inset-0 bg-linear-to-br from-brand/10 to-transparent"
                  aria-hidden="true"
                />
                <PolicyBearMark tone="inverse" className="size-13" />
              </div>
            </div>

            <div className="auth-reveal auth-delay-2 mt-6 text-center">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight text-brand-ink-foreground xl:text-[1.75rem]">
                Every Policy. Every Promise. Every Protection.
              </h2>
              <p className="mt-4 text-sm font-medium leading-6 text-brand-cyan">
                Protection for What Matters Most.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-auto flex items-center justify-between border-t border-brand-ink-foreground/10 pt-5 text-[0.68rem] text-brand-ink-foreground/40">
            <span>A product of Ray Advertising</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Secure access
            </span>
          </div>
        </section>

        {/* Right form panel */}
        <section className="relative flex flex-1 flex-col justify-center bg-white px-6 py-10 sm:px-10 md:w-[460px] md:flex-none lg:px-14">
          <div className="auth-panel w-full max-w-sm lg:mx-auto">
            {/* Mobile logo */}
            <div className="mb-8 md:hidden">
              <img
                src={brandLogo.url}
                alt="PolicyBear"
                className="h-7 w-auto object-contain"
              />
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                Sign in to your workspace
              </h1>
            </div>

            <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Work email
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="name@policybear.com"
                    className="h-12 rounded-xl border-border bg-muted/40 pl-10 pr-4 text-sm transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-12 rounded-xl border-border bg-muted/40 pl-10 pr-11 text-sm transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
                <div className="pt-0.5">
                  <Link to="/" className="text-xs font-semibold text-brand hover:underline">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3.5" /> {error}
                </p>
              )}

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
                <Checkbox defaultChecked className="size-4 rounded border-muted-foreground/30" />
                <span>Keep me signed in for 30 days</span>
              </label>

              <Button
                type="submit"
                size="lg"
                className="auth-submit group h-12 w-full rounded-xl bg-brand-ink text-sm font-semibold text-brand-ink-foreground hover:bg-brand-ink/90"
                disabled={busy}
              >
                {busy ? "Signing in…" : "Continue to workspace"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a href="mailto:info@policybear.com" className="font-semibold text-brand hover:underline">
                Contact info@policybear.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
