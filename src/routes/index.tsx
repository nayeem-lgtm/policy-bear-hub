import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  LockKeyhole,
  PhoneCall,
  ShieldCheck,
  Umbrella,
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
  const [email, setEmail] = useState("ceo@policybear.com");
  const [password, setPassword] = useState("Bear#CEO2026");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (ready && user) void navigate({ to: user.landing, replace: true });
  }, [ready, user, navigate]);

  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Sign in failed.");
      return;
    }
    setError(null);
    void navigate({ to: result.user?.landing ?? "/dashboard", replace: true });
  };

  return (
    <main className="login-shell flex min-h-screen items-center justify-center bg-surface p-4 sm:p-6">
      <div className="login-card flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl md:min-h-[640px] lg:h-[700px] lg:flex-row">
        {/* Left hero panel */}
        <section className="login-hero relative hidden flex-1 overflow-hidden bg-brand-ink px-10 py-8 lg:flex lg:flex-col">
          <div className="auth-grid absolute inset-0" aria-hidden="true" />

          {/* Ambient glows */}
          <div
            className="pointer-events-none absolute -top-[10%] -right-[10%] size-[26rem] rounded-full bg-brand/20 blur-[120px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-[10%] -left-[10%] size-[22rem] rounded-full bg-brand-cyan/15 blur-[100px]"
            aria-hidden="true"
          />

          <div className="relative z-10 flex items-center gap-3 self-start text-brand-ink-foreground">
            <img
              src={brandLogo.url}
              alt="PolicyBear"
              className="h-8 w-auto object-contain brightness-0 invert"
            />
          </div>

          <div className="relative z-10 my-auto flex w-full flex-col items-center justify-center py-10">
            {/* Insurance protection scene */}
            <div className="auth-reveal auth-delay-1 relative grid h-[16rem] w-full max-w-lg place-items-center">
              <div className="guard-ring absolute size-[14rem]" />
              <div className="guard-ring guard-ring-2 absolute size-[14rem]" />
              <div className="guard-ring guard-ring-3 absolute size-[14rem]" />
              <div className="radar-sweep absolute size-[14rem] rounded-full" />

              <div className="orbit-spin absolute size-[12rem]">
                {[Umbrella, HeartPulse, FileText, PhoneCall].map((Icon, i) => (
                  <span
                    key={i}
                    className="absolute grid size-9 place-items-center rounded-xl border border-brand-ink-foreground/15 bg-brand-ink/85 backdrop-blur-sm"
                    style={{
                      top: `${50 - 50 * Math.cos((i * Math.PI) / 2)}%`,
                      left: `${50 + 50 * Math.sin((i * Math.PI) / 2)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <span className="orbit-counter grid place-items-center">
                      <Icon className="size-4 text-brand-cyan" />
                    </span>
                  </span>
                ))}
              </div>

              <div className="shield-float relative grid size-24 place-items-center rounded-[1.6rem] border border-brand-cyan/25 bg-white/10 shadow-brand backdrop-blur-sm">
                <PolicyBearMark tone="inverse" className="size-11" />
              </div>
            </div>

            <div className="auth-reveal auth-delay-2 mt-8 text-center">
              <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-brand-ink-foreground xl:text-4xl">
                Every conversation. Every customer.
                <br />
                One clear view.
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-sm font-medium leading-6 text-brand-ink-foreground/70">
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
        <section className="relative flex flex-1 flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:px-16">
          <div className="auth-panel w-full max-w-sm lg:mx-auto">
            {/* Mobile logo */}
            <div className="mb-8 lg:hidden">
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
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Enter your department credentials to continue.
              </p>
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
                className="auth-submit group h-12 w-full rounded-xl text-sm font-semibold"
                disabled={busy}
              >
                {busy ? "Signing in…" : "Continue to workspace"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
