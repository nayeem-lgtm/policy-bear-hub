import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  FileText,
  HeartPulse,
  LockKeyhole,
  PhoneCall,
  ShieldCheck,
  Sparkles,
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
    <main className="auth-shell grid min-h-screen bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <section className="auth-stage relative hidden min-h-screen overflow-hidden bg-brand-ink px-10 py-9 lg:flex lg:flex-col xl:px-16 xl:py-12">
        <div className="auth-grid absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3 self-start text-brand-ink-foreground">
          <img
            src={brandLogo.url}
            alt="PolicyBear"
            className="h-8 w-auto object-contain brightness-0 invert"
          />
          <span className="h-5 w-px bg-brand-ink-foreground/20" />
          <span className="text-[0.62rem] font-semibold tracking-[0.22em] uppercase text-brand-ink-foreground/60">
            Operations CRM
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-xl py-12">
          <h2 className="auth-reveal auth-delay-1 mt-7 max-w-lg text-4xl leading-[1.12] font-semibold text-brand-ink-foreground xl:text-5xl">
            Every conversation.<br />Every customer.<br />One clear view.
          </h2>
          <p className="auth-reveal auth-delay-2 mt-5 max-w-md text-sm leading-6 text-brand-ink-foreground/65">
            Calls, policies, callbacks and compliance—connected for a faster, more confident workday.
          </p>

          {/* Insurance protection scene */}
          <div className="auth-reveal auth-delay-3 relative mt-10 grid h-[15rem] max-w-lg place-items-center">
            <div className="guard-ring absolute size-[13rem]" />
            <div className="guard-ring guard-ring-2 absolute size-[13rem]" />
            <div className="guard-ring guard-ring-3 absolute size-[13rem]" />
            <div className="radar-sweep absolute size-[13rem] rounded-full" />

            <div className="orbit-spin absolute size-[11.5rem]">
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

            <div className="shield-float relative grid size-24 place-items-center rounded-[1.6rem] border border-brand-cyan/25 bg-brand-cyan/10 shadow-brand backdrop-blur-sm">
              <PolicyBearMark tone="inverse" className="size-11" />
            </div>
          </div>

          <div className="auth-reveal auth-delay-3 mt-8 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-lg border border-brand-ink-foreground/10 bg-brand-ink-foreground/10">
            {[
              ["Live", "Call activity"],
              ["Protected", "Customer data"],
              ["Synced", "Team workflow"],
            ].map(([value, label]) => (
              <div key={label} className="bg-brand-ink/80 px-4 py-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink-foreground">
                  <Check className="size-3.5 text-brand-cyan" /> {value}
                </div>
                <p className="mt-1 text-[0.68rem] text-brand-ink-foreground/45">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-brand-ink-foreground/10 pt-5 text-[0.68rem] text-brand-ink-foreground/40">
          <span>A product of Ray Advertising</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Secure access</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-10">
        <div className="auth-mobile-line absolute inset-x-0 top-0 h-1 lg:hidden" />
        <div className="auth-panel w-full max-w-[27rem] pt-16 sm:pt-0">
          <img
            src={brandLogo.url}
            alt="PolicyBear"
            className="mb-10 h-auto w-52 object-contain sm:w-60"
          />

          <div className="mb-7">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-brand">
              <Sparkles className="size-3.5" /> Welcome back
            </div>
            <h1 className="text-3xl font-semibold text-foreground">Sign in to your workspace</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Enter your department credentials to continue.
            </p>
          </div>

          <form className="space-y-5" onSubmit={(e) => void handleSubmit(e)}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="h-11 bg-card pl-10 shadow-sm transition-shadow focus-visible:shadow-brand"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                    <Link to="/" className="text-xs font-semibold text-brand hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-11 bg-card pr-11 pl-10 shadow-sm transition-shadow focus-visible:shadow-brand"
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
                    className="absolute top-1/2 right-1 size-9 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3.5" /> {error}
                </p>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox defaultChecked /> Keep me signed in on this device
              </label>

              <Button type="submit" size="lg" className="auth-submit group h-11 w-full" disabled={busy}>
                {busy ? "Signing in…" : "Continue to workspace"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Button>
          </form>

        </div>
      </section>
    </main>
  );
}
