// reCAPTCHA v3 server-side verification with graceful demo fallback.
//
// Production: set RECAPTCHA_SECRET_KEY (server env). Every signup token is
// verified against Google and rejected if the bot score is too low.
// Demo mode: no secret configured → accepts (the honeypot + rate limiting
// still protect the form).

export interface CaptchaResult {
  ok: boolean;
  demo: boolean;
  score?: number;
}

const MIN_SCORE = 0.5;

export async function verifyCaptcha(
  token: string | null | undefined,
): Promise<CaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  // Demo mode — no secret configured, skip Google verification
  if (!secret) {
    return { ok: true, demo: true };
  }
  if (!token) {
    return { ok: false, demo: false };
  }

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as {
      success?: boolean;
      score?: number;
    };
    const score = data.score ?? 0;
    return { ok: data.success === true && score >= MIN_SCORE, demo: false, score };
  } catch {
    return { ok: false, demo: false };
  }
}
