import { useEffect, useState } from "react";
import { MapPin, Loader2, Check, Star, ShieldCheck, RefreshCw, Lock } from "lucide-react";
import { GHANA_REGIONS } from "@/server/data/regions";
import { useStore } from "@/client/store";
import { rpcClient } from "@/client/rpc-client";
import { useI18n } from "@/client/lib/i18n";
import { Modal, Button } from "./ui";
import { LogoMark } from "@/client/lib/logo";
import { cn } from "@/client/lib/format";

export function AuthModal({
  mode,
  onClose,
  onSwitchMode,
}: {
  mode: "login" | "signup" | null;
  onClose: () => void;
  onSwitchMode: (m: "login" | "signup") => void;
}) {
  const { signup, login, toast, setUser } = useStore();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [hometown, setHometown] = useState("");
  const [diasporaCountry, setDiasporaCountry] = useState("");
  const [church, setChurch] = useState("");
  const [profession, setProfession] = useState("");
  const [agree, setAgree] = useState(false);

  // verification
  const [verifyCode, setVerifyCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  // password reset
  const [authView, setAuthView] = useState<"login" | "forgot" | "reset">("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetDevCode, setResetDevCode] = useState<string | null>(null);

  useEffect(() => {
    setStep(1);
    setBusy(false);
    setAgree(false);
    setVerifyCode("");
    setDevCode(null);
    setAuthView("login");
    setResetCode("");
    setNewPassword("");
    setResetDevCode(null);
  }, [mode]);

  const open = mode !== null;

  const handleLogin = async () => {
    if (!email) return toast("Enter your email address", "error");
    if (!password) return toast("Enter your password", "error");
    setBusy(true);
    try {
      const m = await login(email, password);
      toast(m.emailVerified ? `Welcome back, ${m.name.split(" ")[0]}! 🇬🇭` : "Welcome! Verify your email to finish signing up.");
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Sign in failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    if (step === 1) {
      if (!name.trim() || !email.trim()) return toast("Name and email are required", "error");
      if (password.length < 8) return toast("Password must be at least 8 characters", "error");
      if (!agree) return toast("Please accept the Adom Circle Values to continue", "error");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!region) return toast("Please select your region in Ghana", "error");
      setBusy(true);
      try {
        const res = await signup({
          name,
          email,
          phone: phone || null,
          region,
          hometown,
          diasporaCountry,
          church,
          profession,
          password,
        });
        setDevCode(res.devCode);
        setStep(3);
        toast("Account created! Check your email for the verification code.");
      } catch (e: any) {
        toast(e?.message ?? "Sign up failed", "error");
      } finally {
        setBusy(false);
      }
      return;
    }
    // step 3: verify
    if (verifyCode.length !== 6) return toast("Enter the 6-digit code", "error");
    setBusy(true);
    try {
      await rpcClient.members.verifyEmail({ email, code: verifyCode });
      toast("Email verified! +10 points 🎉");
      // Refresh the stored user so the "verify your email" banner disappears
      const m = await rpcClient.members.byId(email ? (localStorage.getItem("adom_member_id") ?? "") : "");
      if (m) setUser(m);
      onClose();
    } catch (e: any) {
      toast(e?.message ?? "Verification failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setBusy(true);
    try {
      const res = await rpcClient.members.resendVerification({ email });
      setDevCode(res.devCode);
      toast("New code sent to your email");
    } catch (e: any) {
      toast(e?.message ?? "Failed to resend", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email) return toast("Enter your email address", "error");
    setBusy(true);
    try {
      const res = await rpcClient.members.requestReset({ email });
      setResetDevCode(res.devCode);
      setAuthView("reset");
      toast("If that email exists, a reset code is on its way.");
    } catch (e: any) {
      toast(e?.message ?? "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (resetCode.length !== 6) return toast("Enter the 6-digit code", "error");
    if (newPassword.length < 8) return toast("New password must be at least 8 characters", "error");
    setBusy(true);
    try {
      await rpcClient.members.resetPassword({ email, code: resetCode, newPassword });
      toast("Password reset! Sign in with your new password.");
      setAuthView("login");
      setPassword("");
    } catch (e: any) {
      toast(e?.message ?? "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide={mode === "signup"}>
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <p className="font-display font-bold text-xl leading-none">
              {mode === "signup" ? t("joinTitle") : authView === "login" ? "Welcome back" : authView === "forgot" ? "Reset password" : "Set a new password"}
            </p>
            <p className="mt-1 text-sm text-fg/50">{t("joinSub")} 🇬🇭</p>
          </div>
        </div>
        <span className="flag-stripes mb-6 block h-[3px] w-20 rounded-full" aria-hidden />

        {/* ============ LOGIN / FORGOT / RESET ============ */}
        {mode === "login" && authView === "login" && (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20"
              />
            </label>
            <div className="flex justify-end">
              <button
                onClick={() => setAuthView("forgot")}
                className="text-xs font-bold text-flag-red hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <Button variant="gold" className="w-full py-3" onClick={handleLogin} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Sign in to the Circle"}
            </Button>
            <p className="text-center text-xs text-fg/45">
              Demo account: <strong>admin@adomcircle.org</strong> · <strong>Adom@2026</strong>
            </p>
            <p className="text-center text-xs text-fg/50">
              New here?{" "}
              <button
                className="font-bold text-flag-red cursor-pointer"
                onClick={() => onSwitchMode("signup")}
              >
                Join free
              </button>
            </p>
          </div>
        )}

        {mode === "login" && authView === "forgot" && (
          <div className="space-y-4 animate-fade-up">
            <p className="rounded-2xl bg-soft px-4 py-3 text-[13px] leading-relaxed text-fg/70">
              <Lock size={13} className="mr-1.5 inline text-flag-red" />
              Enter your account email and we'll send a 6-digit reset code (valid 30 minutes).
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20"
              />
            </label>
            <Button variant="gold" className="w-full py-3" onClick={handleForgot} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Send reset code"}
            </Button>
            <p className="text-center text-xs">
              <button onClick={() => setAuthView("login")} className="font-bold text-flag-red cursor-pointer">
                ← Back to sign in
              </button>
            </p>
          </div>
        )}

        {mode === "login" && authView === "reset" && (
          <div className="space-y-4 animate-fade-up">
            <p className="rounded-2xl bg-soft px-4 py-3 text-[13px] leading-relaxed text-fg/70">
              Enter the 6-digit code sent to <strong>{email}</strong> and choose a new password.
            </p>
            {resetDevCode && (
              <p className="rounded-2xl border border-flag-gold/50 bg-gold-soft/25 px-4 py-2.5 text-[13px] text-fg/70">
                <strong>Demo:</strong> your reset code is <strong className="font-display text-lg text-flag-red">{resetDevCode}</strong>
              </p>
            )}
            <input
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-center font-display text-2xl tracking-[0.4em] outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20"
            />
            <Button variant="gold" className="w-full py-3" onClick={handleReset} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : "Reset password"}
            </Button>
            <p className="text-center text-xs">
              <button onClick={() => setAuthView("login")} className="font-bold text-flag-red cursor-pointer">
                ← Back to sign in
              </button>
            </p>
          </div>
        )}

        {/* ============ SIGNUP ============ */}
        {mode === "signup" && (
          <div>
            {/* Stepper */}
            <div className="mb-6 flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      step === s
                        ? "bg-flag-red text-cream"
                        : step > s
                          ? "bg-flag-green text-cream"
                          : "bg-ink/10 text-fg/50",
                    )}
                  >
                    {step > s ? <Check size={14} /> : s}
                  </div>
                  {s < 3 && <div className={cn("h-0.5 flex-1 rounded", step > s ? "bg-flag-green" : "bg-ink/10")} />}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4 animate-fade-up">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Full name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Owusu"
                    className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Email</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                      className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Phone (optional)</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 ..."
                      className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20" />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">
                    Password <span className="font-normal normal-case text-fg/40">(min 8 characters)</span>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20"
                  />
                </label>
                {/* Honeypot — hidden from humans, bots fill it */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={""}
                  onChange={() => {}}
                  className="hidden"
                  aria-hidden="true"
                />

                <div className="rounded-2xl border border-flag-gold/60 bg-gold-soft/30 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-bold text-fg">
                    <Star size={15} className="text-flag-red" /> Adom Circle Values — please accept to join
                  </p>
                  <ul className="space-y-1.5 text-[13px] leading-relaxed text-fg/70">
                    <li>• I accept and will abide by the Constitution of Ghana, which is supreme over any denomination, institution or group.</li>
                    <li>• I respect religious freedom and peaceful coexistence.</li>
                    <li>• I commit to a peaceful, constructive and future-oriented tone in this community.</li>
                  </ul>
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-flag-green" />
                    <span className="text-[13px] font-medium text-fg/80">I accept the Adom Circle Values and community guidelines.</span>
                  </label>
                </div>

                <Button variant="gold" className="w-full py-3" onClick={handleSignup}>
                  Continue — your Ghana connection
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fade-up">
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg/50">
                    <MapPin size={13} className="text-flag-red" /> Which region in Ghana are you from?
                  </span>
                  <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                    {GHANA_REGIONS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setRegion(r.id)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer",
                          region === r.id
                            ? "border-flag-green bg-flag-green/10 ring-2 ring-flag-green/30"
                            : "border-fg/10 bg-card hover:border-flag-green/50",
                        )}
                      >
                        <span className="block text-[13px] font-bold">{r.name}</span>
                        <span className="block text-[11px] text-fg/50">{r.capital}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Hometown (optional)</span>
                    <input value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder="e.g. Kumasi"
                      className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Diaspora country (optional)</span>
                    <input value={diasporaCountry} onChange={(e) => setDiasporaCountry(e.target.value)} placeholder="e.g. Canada"
                      className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Church / denomination (optional)</span>
                    <input value={church} onChange={(e) => setChurch(e.target.value)} placeholder="e.g. Methodist"
                      className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-fg/50">Profession (optional)</span>
                    <input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Nurse"
                      className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-3 text-sm outline-none focus:border-flag-red focus:ring-2 focus:ring-flag-red/20" />
                  </label>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="dark" className="flex-1" onClick={handleSignup} disabled={busy}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : "Create account 🇬🇭"}
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-fade-up">
                <div className="flex items-center gap-3 rounded-2xl border border-flag-green/25 bg-flag-green/5 p-4">
                  <ShieldCheck size={22} className="shrink-0 text-flag-green" />
                  <p className="text-[13px] leading-relaxed text-fg/75">
                    Almost there! We sent a <strong>6-digit verification code</strong> to{" "}
                    <strong>{email}</strong>. Enter it below to activate your account.
                  </p>
                </div>

                {devCode && (
                  <p className="rounded-2xl border border-flag-gold/50 bg-gold-soft/25 px-4 py-2.5 text-[13px] text-fg/70">
                    <strong>Demo:</strong> your verification code is{" "}
                    <strong className="font-display text-xl tracking-widest text-flag-red">{devCode}</strong>
                  </p>
                )}

                <input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-fg/15 bg-card px-4 py-4 text-center font-display text-3xl tracking-[0.5em] outline-none focus:border-flag-green focus:ring-2 focus:ring-flag-green/20"
                />

                <Button variant="gold" className="w-full py-3" onClick={handleSignup} disabled={busy}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : "Verify my email"}
                </Button>

                <button
                  onClick={resendCode}
                  disabled={busy}
                  className="mx-auto flex items-center gap-1.5 text-xs font-bold text-flag-green hover:underline cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} /> Didn't get it? Resend code
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
