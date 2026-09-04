import { os } from "@orpc/server";
import { z } from "zod";
import { randomUUID, randomInt, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createKV } from "../lib/create-kv";
import { POINTS, rankFor } from "../data/ranks";
import { notify } from "./notifications";
import { emailKV, type OutboxEmail } from "./emails";
import { verifyCaptcha } from "../lib/captcha";

export const MemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.enum(["member", "vip", "moderator", "admin", "partner"]),
  region: z.string(),
  hometown: z.string(),
  diasporaCountry: z.string(),
  church: z.string(),
  profession: z.string(),
  bio: z.string(),
  avatarImage: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  badges: z.array(z.string()),
  pledgeVote: z.boolean(),
  points: z.number(),
  managedRooms: z.array(z.string()),
  passwordHash: z.string(),
  salt: z.string(),
  emailVerified: z.boolean(),
  verifyToken: z.string().nullable(),
  verifyExpires: z.string().nullable(),
  resetToken: z.string().nullable(),
  resetExpires: z.string().nullable(),
  joinedAt: z.string(),
  lastSeenAt: z.string().nullable().optional(),
  following: z.array(z.string()),
  friends: z.array(z.string()).optional(),
  followerCount: z.number(),
  savedMessages: z.array(z.string()),
  status: z.enum(["active", "suspended"]),
  verified: z.boolean(),
  merchantName: z.string(),
  privacy: z.object({
    showRegion: z.boolean(),
    showHometown: z.boolean(),
    showProfession: z.boolean(),
    showBadges: z.boolean(),
    showPoints: z.boolean(),
  }),
});

export type Member = z.output<typeof MemberSchema>;
export type MemberRole = Member["role"];

// Stored members created before these fields existed — fill safe defaults
export function normalizeMember(m: Member): Member {
  return {
    ...m,
    following: m.following ?? [],
    friends: m.friends ?? [],
    followerCount: m.followerCount ?? 0,
    savedMessages: m.savedMessages ?? [],
    status: m.status ?? "active",
    verified: m.verified ?? false,
    merchantName: m.merchantName ?? "",
    lastSeenAt: m.lastSeenAt ?? null,
    avatarImage: m.avatarImage ?? null,
    coverImage: m.coverImage ?? null,
    privacy: m.privacy ?? {
      showRegion: true,
      showHometown: true,
      showProfession: true,
      showBadges: true,
      showPoints: true,
    },
  };
}

// Record that a member was just active (login, API use, etc.) — powers the
// online/offline dot. Cheap: one write, throttled naturally by usage.
export async function touchLastSeen(memberId: string): Promise<void> {
  if (!memberId) return;
  try {
    const raw = await memberKV.getItem(memberId);
    if (!raw) return;
    const member = normalizeMember(raw);
    const now = new Date().toISOString();
    // Avoid a write every single request — only update if > 60s old
    if (member.lastSeenAt && now < new Date(new Date(member.lastSeenAt).getTime() + 60_000).toISOString()) {
      return;
    }
    await memberKV.setItem(memberId, { ...member, lastSeenAt: now });
  } catch {
    // non-fatal
  }
}

// The public face of a member — never exposes password or token material
export type PublicMember = Omit<
  Member,
  | "passwordHash"
  | "salt"
  | "verifyToken"
  | "verifyExpires"
  | "resetToken"
  | "resetExpires"
>;

export const memberKV = createKV<Member>("members");
const sessionKV = createKV<{ memberId: string; createdAt: string }>("sessions");
const attemptKV = createKV<{ count: number; firstAt: string }>("auth-attempts");

// ---------- Friend requests ----------
// A request must be accepted by the other party before the two members become
// friends. Pending requests can be cancelled by the sender or declined by the
// receiver; acceptances are recorded on both member records (friends[]).
export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}
export const friendRequestKV = createKV<FriendRequest>("friend-requests");

// ---------- Password hashing (scrypt — no external deps) ----------

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
): { salt: string; hash: string } {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): boolean {
  try {
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function sanitizeMember(m: Member): PublicMember {
  const {
    passwordHash: _p,
    salt: _s,
    verifyToken: _v,
    verifyExpires: _ve,
    resetToken: _r,
    resetExpires: _re,
    ...pub
  } = m;
  return pub;
}

// ---------- Sessions ----------

export async function createSession(memberId: string): Promise<string> {
  const token = randomUUID();
  await sessionKV.setItem(token, { memberId, createdAt: new Date().toISOString() });
  return token;
}

export async function memberFromToken(token: string): Promise<Member | null> {
  if (!token) return null;
  const s = await sessionKV.getItem(token);
  if (!s) return null;
  const member = await memberKV.getItem(s.memberId);
  if (member) void touchLastSeen(member.id);
  return member;
}

// ---------- Email sending (demo outbox; Resend in production) ----------
// With RESEND_API_KEY set, emails are delivered through Resend (api.resend.com)
// and the outbox doubles as an audit log. Without it, emails land only in the
// outbox (demo mode) so flows stay testable.

const CODE_TTL_MS = 1000 * 60 * 60 * 24; // verification codes: 24h
const RESET_TTL_MS = 1000 * 60 * 30; // reset codes: 30 min

function makeCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Simple branded HTML email — flag colours, no external assets
function emailHtml(subject: string, body: string, code: string | null): string {
  const codeBlock = code
    ? `<p style="margin:24px 0 4px;font-size:13px;color:#555">Your code:</p>
       <p style="margin:4px 0 24px;font-size:30px;font-weight:bold;letter-spacing:10px;color:#ce1126">${escHtml(code)}</p>`
    : "";
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#faf6ec;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ec;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eee">
<tr><td style="background:#0d1f17;padding:20px 32px">
  <span style="color:#fcd116;font-size:20px;font-weight:bold;letter-spacing:3px">ADOM&nbsp;CIRCLE</span>
  <span style="color:#f3efe4;font-size:12px;letter-spacing:1px;margin-left:10px">· One Circle. One Ghana.</span>
</td></tr>
<tr><td style="padding:32px;color:#0d1f17">
  <h1 style="margin:0 0 16px;font-size:20px">${escHtml(subject)}</h1>
  <p style="margin:0;font-size:14px;line-height:1.7;color:#333">${escHtml(body).replace(/\n/g, "<br/>")}</p>
  ${codeBlock}
  <p style="margin:24px 0 0;font-size:12px;color:#999">You received this email because of activity on adomcircle.org. If you didn't request this, you can safely ignore it.</p>
</td></tr>
<tr><td style="background:#0d1f17;padding:14px 32px;text-align:center">
  <span style="color:#f3efe4;font-size:11px">© 2026 Adom Circle · adomcircle.org</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  debugCode: string | null;
}): Promise<OutboxEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  let live = false;
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? "Adom Circle <noreply@adomcircle.org>",
          to: opts.to,
          subject: opts.subject,
          html: emailHtml(opts.subject, opts.body, opts.debugCode),
        }),
      });
      if (!res.ok) {
        console.error(`Resend error ${res.status}:`, await res.text());
      } else {
        live = true;
      }
    } catch (err) {
      console.error("Resend send failed:", err);
    }
  }
  // Always keep the outbox as an audit log (Admin → Mailbox)
  const email: OutboxEmail = {
    id: randomUUID(),
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    debugCode: live ? null : opts.debugCode, // hide demo codes once real mail flows
    sentAt: new Date().toISOString(),
    read: false,
  };
  await emailKV.setItem(email.id, email);
  return email;
}

// ---------- Anti-spam: simple per-email rate limiting + honeypot ----------

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

async function checkRate(key: string): Promise<void> {
  const rec = await attemptKV.getItem(key);
  if (!rec) return;
  if (Date.now() - new Date(rec.firstAt).getTime() > RATE_WINDOW_MS) {
    await attemptKV.removeItem(key);
    return;
  }
  if (rec.count >= RATE_LIMIT) {
    throw new Error("Too many attempts. Please try again in 15 minutes.");
  }
}

async function recordAttempt(key: string): Promise<void> {
  const rec = await attemptKV.getItem(key);
  if (!rec) await attemptKV.setItem(key, { count: 1, firstAt: new Date().toISOString() });
  else await attemptKV.setItem(key, { count: rec.count + 1, firstAt: rec.firstAt });
}

async function clearAttempts(key: string): Promise<void> {
  await attemptKV.removeItem(key);
}

// ---------- Points & ranks ----------

export async function addPoints(memberId: string, pts: number): Promise<Member> {
  const member = await memberKV.getItem(memberId);
  if (!member) throw new Error("Member not found");
  const prevRank = rankFor(member.points);
  const points = member.points + pts;
  const rank = rankFor(points);
  const badges = member.badges.filter((b) => b !== rank.title);
  badges.unshift(rank.title);
  const updated = { ...member, points, badges };
  await memberKV.setItem(member.id, updated);
  // Rank-up celebration notification
  if (rank.title !== prevRank.title && rank.level > prevRank.level) {
    await notify(
      member.id,
      "rank",
      `Rank up: ${rank.title}! 🏆`,
      `You've climbed the Adom Circle ladder with ${points.toLocaleString()} points. Keep contributing!`,
    ).catch(() => {});
  }
  return updated;
}

export async function requireAdmin(adminId: string): Promise<Member> {
  const admin = await memberKV.getItem(adminId);
  if (!admin || admin.role !== "admin") throw new Error("Admin access required");
  return admin;
}

export async function requireMember(memberId: string): Promise<Member> {
  const member = await memberKV.getItem(memberId);
  if (!member) throw new Error("Member not found. Please sign in.");
  const m = normalizeMember(member);
  if (m.status === "suspended") {
    throw new Error("Your account has been suspended. Contact the administrators.");
  }
  return m;
}

// Delegated moderation: admins OR moderators managing the target room.
export async function canModerate(memberId: string, roomId: string): Promise<boolean> {
  const m = await memberKV.getItem(memberId);
  if (!m) return false;
  if (m.role === "admin") return true;
  return m.role === "moderator" && m.managedRooms.includes(roomId);
}

// Delegation: VIP members get elevated content privileges (e.g. creating events).
export async function canCreateEvents(memberId: string): Promise<Member> {
  const m = await memberKV.getItem(memberId);
  if (!m) throw new Error("Member not found. Please sign in.");
  if (m.role === "admin" || m.role === "moderator" || m.role === "vip") return m;
  throw new Error("Event creation requires VIP, moderator or admin status. Keep contributing to climb the ranks!");
}

// ---------- Router ----------

export const members = {
  signup: os
    .input(
      MemberSchema.pick({
        name: true,
        email: true,
        phone: true,
        region: true,
        hometown: true,
        diasporaCountry: true,
        church: true,
        profession: true,
      }).extend({
        password: z.string().min(8, "Password must be at least 8 characters"),
        // Honeypot: bots fill hidden fields — must stay empty
        website: z.string().max(0, "Invalid request").optional(),
        // reCAPTCHA v3 token (optional in demo mode, required when configured)
        captchaToken: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      if (input.website) throw new Error("Invalid request"); // bot detected
      // reCAPTCHA v3 check (skips gracefully when no secret is configured)
      const captcha = await verifyCaptcha(input.captchaToken);
      if (!captcha.ok) throw new Error("Human verification failed. Please try again.");
      await checkRate(`signup:${input.email.toLowerCase()}`);
      const existing = await memberKV.getAllItems();
      const found = existing.find(
        (m) => m.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (found) throw new Error("An account with that email already exists. Sign in instead.");
      const { salt, hash } = hashPassword(input.password);
      const code = makeCode();
      const member: Member = {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: "member",
        region: input.region,
        hometown: input.hometown,
        diasporaCountry: input.diasporaCountry,
        church: input.church,
        profession: input.profession,
        bio: "",
        badges: ["New Member"],
        pledgeVote: false,
        points: POINTS.SIGNUP,
        managedRooms: [],
        passwordHash: hash,
        salt,
        emailVerified: false,
        verifyToken: code,
        verifyExpires: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        resetToken: null,
        resetExpires: null,
        joinedAt: new Date().toISOString(),
        following: [],
        followerCount: 0,
        savedMessages: [],
        status: "active",
        verified: false,
        merchantName: "",
        privacy: {
          showRegion: true,
          showHometown: true,
          showProfession: true,
          showBadges: true,
          showPoints: true,
        },
      };
      await memberKV.setItem(member.id, member);
      const sent = await sendEmail({
        to: member.email,
        subject: "Verify your Adom Circle email",
        body: `Your verification code is: ${code}\n\nEnter it on the site to activate your account. It expires in 24 hours.`,
        debugCode: code,
      });
      await recordAttempt(`signup:${input.email.toLowerCase()}`);
      return { member: sanitizeMember(member), devCode: sent.debugCode };
    }),

  login: os
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .handler(async ({ input }) => {
      const key = `login:${input.email.toLowerCase()}`;
      await checkRate(key);
      const existing = await memberKV.getAllItems();
      const found = existing.find(
        (m) => m.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (!found || !verifyPassword(input.password, found.salt, found.passwordHash)) {
        await recordAttempt(key);
        throw new Error("Incorrect email or password.");
      }
      const foundNorm = normalizeMember(found);
      if (foundNorm.status === "suspended") {
        await recordAttempt(key);
        throw new Error("This account has been suspended. Contact the administrators.");
      }
      await clearAttempts(key);
      const token = await createSession(found.id);
      await touchLastSeen(found.id);
      return { member: sanitizeMember(foundNorm), token };
    }),

  me: os.input(z.object({ token: z.string() })).handler(async ({ input }) => {
    const member = await memberFromToken(input.token);
    return member ? sanitizeMember(member) : null;
  }),

  logout: os.input(z.object({ token: z.string() })).handler(async ({ input }) => {
    await sessionKV.removeItem(input.token);
  }),

  verifyEmail: os
    .input(z.object({ email: z.string().email(), code: z.string().length(6) }))
    .handler(async ({ input }) => {
      const existing = await memberKV.getAllItems();
      const found = existing.find(
        (m) => m.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (!found) throw new Error("No account found for that email.");
      if (found.emailVerified) throw new Error("Email already verified.");
      if (
        !found.verifyToken ||
        found.verifyToken !== input.code ||
        !found.verifyExpires ||
        new Date(found.verifyExpires).getTime() < Date.now()
      ) {
        throw new Error("Invalid or expired code. Request a new one.");
      }
      // Reward verification (points first — addPoints re-reads from storage,
      // so set the verified flag AFTER it to avoid overwriting)
      let updated = await addPoints(found.id, 10);
      const badges = updated.badges.filter((b) => b !== "Verified Member");
      badges.unshift("Verified Member");
      updated = {
        ...updated,
        emailVerified: true,
        verifyToken: null,
        verifyExpires: null,
        badges,
      };
      await memberKV.setItem(updated.id, updated);
      await notify(
        updated.id,
        "system",
        "Email verified ✅",
        "Your Adom Circle account is active. Welcome aboard!",
      ).catch(() => {});
      return sanitizeMember(updated);
    }),

  resendVerification: os
    .input(z.object({ email: z.string().email() }))
    .handler(async ({ input }) => {
      const existing = await memberKV.getAllItems();
      const found = existing.find(
        (m) => m.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (!found) throw new Error("No account found for that email.");
      if (found.emailVerified) throw new Error("Email already verified.");
      const code = makeCode();
      const updated = {
        ...found,
        verifyToken: code,
        verifyExpires: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      };
      await memberKV.setItem(updated.id, updated);
      const sent = await sendEmail({
        to: updated.email,
        subject: "Verify your Adom Circle email (new code)",
        body: `Your new verification code is: ${code}\n\nIt expires in 24 hours.`,
        debugCode: code,
      });
      return { devCode: sent.debugCode };
    }),

  requestReset: os
    .input(z.object({ email: z.string().email() }))
    .handler(async ({ input }) => {
      const key = `reset:${input.email.toLowerCase()}`;
      await checkRate(key);
      const existing = await memberKV.getAllItems();
      const found = existing.find(
        (m) => m.email.toLowerCase() === input.email.toLowerCase(),
      );
      // Always return success to avoid leaking which emails exist
      let devCode: string | null = null;
      let code: string | null = null;
      if (found) {
        code = makeCode();
        const updated = {
          ...found,
          resetToken: code,
          resetExpires: new Date(Date.now() + RESET_TTL_MS).toISOString(),
        };
        await memberKV.setItem(updated.id, updated);
        const sent = await sendEmail({
          to: updated.email,
          subject: "Reset your Adom Circle password",
          body: `Your password reset code is: ${code}\n\nIt expires in 30 minutes. Never share it with anyone.`,
          debugCode: code,
        });
        devCode = sent.debugCode;
      }
      await recordAttempt(key);
      return { devCode };
    }),

  resetPassword: os
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      }),
    )
    .handler(async ({ input }) => {
      const existing = await memberKV.getAllItems();
      const found = existing.find(
        (m) => m.email.toLowerCase() === input.email.toLowerCase(),
      );
      if (!found) throw new Error("No account found for that email.");
      if (
        !found.resetToken ||
        found.resetToken !== input.code ||
        !found.resetExpires ||
        new Date(found.resetExpires).getTime() < Date.now()
      ) {
        throw new Error("Invalid or expired reset code. Request a new one.");
      }
      const { salt, hash } = hashPassword(input.newPassword);
      const updated: Member = {
        ...found,
        passwordHash: hash,
        salt,
        resetToken: null,
        resetExpires: null,
      };
      await memberKV.setItem(updated.id, updated);
      await notify(
        updated.id,
        "system",
        "Password changed 🔒",
        "Your Adom Circle password was successfully reset.",
      ).catch(() => {});
      // Auto-login after a successful reset — no need to sign in again
      const token = await createSession(updated.id);
      return { ok: true, member: sanitizeMember(updated), token };
    }),

  byId: os.input(z.string()).handler(async ({ input }) => {
    const m = await memberKV.getItem(input);
    return m ? sanitizeMember(normalizeMember(m)) : null;
  }),

  search: os
    .input(z.object({ q: z.string().min(1).max(50) }))
    .handler(async ({ input }) => {
      const q = input.q.toLowerCase();
      const all = await memberKV.getAllItems();
      return all
        .filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
        .slice(0, 8)
        .map((m) => ({ id: m.id, name: m.name }));
    }),

  follow: os
    .input(z.object({ memberId: z.string(), targetId: z.string() }))
    .handler(async ({ input }) => {
      const me = await requireMember(input.memberId);
      if (me.id === input.targetId) throw new Error("You can't follow yourself");
      const target = await memberKV.getItem(input.targetId);
      if (!target) throw new Error("Member not found");
      const following = me.following.includes(target.id);
      const meUpdated: Member = {
        ...me,
        following: following
          ? me.following.filter((id) => id !== target.id)
          : [...me.following, target.id],
      };
      await memberKV.setItem(me.id, meUpdated);
      const targetUpdated: Member = {
        ...normalizeMember(target),
        followerCount: Math.max(0, target.followerCount + (following ? -1 : 1)),
      };
      await memberKV.setItem(target.id, targetUpdated);
      if (!following) {
        await notify(
          target.id,
          "system",
          `${me.name} started following you`,
          "They'll see your activity in the community.",
        ).catch(() => {});
      }
      return sanitizeMember(meUpdated);
    }),

  // ---------- Friends (mutual, request → accept) ----------

  sendFriendRequest: os
    .input(z.object({ memberId: z.string(), targetId: z.string() }))
    .handler(async ({ input }) => {
      const me = await requireMember(input.memberId);
      if (me.id === input.targetId) throw new Error("You can't add yourself as a friend");
      const target = await memberKV.getItem(input.targetId);
      if (!target) throw new Error("Member not found");
      if ((me.friends ?? []).includes(target.id)) throw new Error("You are already friends");
      const pending = (await friendRequestKV.getAllItems()).find(
        (r) =>
          r.status === "pending" &&
          ((r.fromId === me.id && r.toId === target.id) || (r.fromId === target.id && r.toId === me.id)),
      );
      if (pending) throw new Error("A friend request is already pending with this member");
      // A declined request stays on record quietly (never surfaced as
      // "declined") so the sender can't keep re-requesting the same person.
      const previouslyDeclined = (await friendRequestKV.getAllItems()).some(
        (r) => r.fromId === me.id && r.toId === target.id && r.status === "declined",
      );
      if (previouslyDeclined) {
        throw new Error("A friend request to this member was already sent.");
      }
      const request: FriendRequest = {
        id: randomUUID(),
        fromId: me.id,
        fromName: me.name,
        toId: target.id,
        toName: target.name,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await friendRequestKV.setItem(request.id, request);
      await notify(
        target.id,
        "friend",
        `${me.name} sent you a friend request`,
        `${me.name} wants to be your friend — open your profile to accept.`,
      ).catch(() => {});
      return request;
    }),

  respondFriendRequest: os
    .input(z.object({ memberId: z.string(), requestId: z.string(), accept: z.boolean() }))
    .handler(async ({ input }) => {
      const me = await requireMember(input.memberId);
      const request = await friendRequestKV.getItem(input.requestId);
      if (!request || request.toId !== me.id) throw new Error("Friend request not found");
      if (request.status !== "pending") throw new Error("This request is no longer pending");
      if (input.accept) {
        const from = await memberKV.getItem(request.fromId);
        const to = await memberKV.getItem(request.toId);
        if (from && to) {
          const fromNorm = normalizeMember(from);
          const toNorm = normalizeMember(to);
          const fromFriends = fromNorm.friends ?? [];
          const toFriends = toNorm.friends ?? [];
          if (!fromFriends.includes(to.id)) {
            await memberKV.setItem(from.id, { ...fromNorm, friends: [...fromFriends, to.id] });
          }
          if (!toFriends.includes(from.id)) {
            await memberKV.setItem(to.id, { ...toNorm, friends: [...toFriends, from.id] });
          }
          await notify(
            from.id,
            "friend",
            `${to.name} accepted your friend request`,
            `You and ${to.name} are now friends on Adom Circle.`,
          ).catch(() => {});
        }
        await friendRequestKV.removeItem(request.id);
      } else {
        // Decline: keep a quiet record (status declined) — never notify the
        // sender. The sender's request simply disappears; a later "cannot
        // request" state keeps things neutral instead of saying "declined".
        await friendRequestKV.setItem(request.id, { ...request, status: "declined" });
      }
      return { ok: true };
    }),

  cancelFriendRequest: os
    .input(z.object({ memberId: z.string(), requestId: z.string() }))
    .handler(async ({ input }) => {
      const me = await requireMember(input.memberId);
      const request = await friendRequestKV.getItem(input.requestId);
      if (!request || request.fromId !== me.id) throw new Error("Friend request not found");
      await friendRequestKV.removeItem(request.id);
      return { ok: true };
    }),

  removeFriend: os
    .input(z.object({ memberId: z.string(), friendId: z.string() }))
    .handler(async ({ input }) => {
      const me = await requireMember(input.memberId);
      const friend = await memberKV.getItem(input.friendId);
      if (!friend) throw new Error("Member not found");
      const meNorm = normalizeMember(me);
      const friendNorm = normalizeMember(friend);
      const meFriends = meNorm.friends ?? [];
      const friendFriends = friendNorm.friends ?? [];
      const nextMe = { ...meNorm, friends: meFriends.filter((id) => id !== friend.id) };
      const nextFriend = { ...friendNorm, friends: friendFriends.filter((id) => id !== me.id) };
      await memberKV.setItem(me.id, nextMe);
      await memberKV.setItem(friend.id, nextFriend);
      return sanitizeMember(nextMe);
    }),

  friendRequests: os
    .input(z.object({ memberId: z.string() }))
    .handler(async ({ input }) => {
      const me = await requireMember(input.memberId);
      const all = (await friendRequestKV.getAllItems()).filter((r) => r.status === "pending");
      return {
        incoming: all
          .filter((r) => r.toId === me.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        outgoing: all
          .filter((r) => r.fromId === me.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        // Members who declined the current user — shown neutrally (never as
        // "declined"); used to hide the "Add friend" button for them.
        cannotSendTo: (await friendRequestKV.getAllItems())
          .filter((r) => r.fromId === me.id && r.status === "declined")
          .map((r) => r.toId),
      };
    }),

  update: os
    .input(
      z.object({
        id: z.string(),
        patch: MemberSchema.pick({
          name: true,
          phone: true,
          hometown: true,
          diasporaCountry: true,
          church: true,
          profession: true,
          bio: true,
          privacy: true,
        }).partial(),
      }),
    )
    .handler(async ({ input }) => {
      const member = await memberKV.getItem(input.id);
      if (!member) throw new Error("Member not found");
      const updated = { ...member, ...input.patch };
      await memberKV.setItem(input.id, updated);
      return sanitizeMember(updated);
    }),

  pledge: os
    .input(z.object({ id: z.string(), pledge: z.boolean() }))
    .handler(async ({ input }) => {
      const member = await memberKV.getItem(input.id);
      if (!member) throw new Error("Member not found");
      const badges = member.badges.filter((b) => b !== "Voter");
      if (input.pledge) badges.unshift("Voter");
      let updated: Member = { ...member, pledgeVote: input.pledge, badges };
      if (input.pledge && !member.pledgeVote) {
        updated = await addPoints(member.id, POINTS.PLEDGE);
        updated = { ...updated, pledgeVote: true };
      }
      await memberKV.setItem(updated.id, updated);
      return sanitizeMember(updated);
    }),

  list: os.input(z.object({ adminId: z.string() })).handler(async ({ input }) => {
    await requireAdmin(input.adminId);
    return (await memberKV.getAllItems())
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
      .map((m) => sanitizeMember(normalizeMember(m)));
  }),

  setRole: os
    .input(
      z.object({
        adminId: z.string(),
        memberId: z.string(),
        role: z.enum(["member", "vip", "moderator", "admin", "partner"]),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const m = await memberKV.getItem(input.memberId);
      if (!m) throw new Error("Member not found");
      const updated = { ...m, role: input.role };
      await memberKV.setItem(m.id, updated);
      return sanitizeMember(updated);
    }),

  setManagedRooms: os
    .input(
      z.object({
        adminId: z.string(),
        memberId: z.string(),
        rooms: z.array(z.string()),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const m = await memberKV.getItem(input.memberId);
      if (!m) throw new Error("Member not found");
      const updated = { ...m, managedRooms: input.rooms };
      await memberKV.setItem(m.id, updated);
      return sanitizeMember(updated);
    }),

  setPoints: os
    .input(
      z.object({
        adminId: z.string(),
        memberId: z.string(),
        points: z.number().min(0),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const m = await memberKV.getItem(input.memberId);
      if (!m) throw new Error("Member not found");
      const rank = rankFor(input.points);
      const badges = m.badges.filter((b) => b !== rank.title);
      badges.unshift(rank.title);
      const updated = { ...m, points: input.points, badges };
      await memberKV.setItem(m.id, updated);
      return sanitizeMember(updated);
    }),

  remove: os
    .input(z.object({ adminId: z.string(), memberId: z.string() }))
    .handler(async ({ input }) => {
      const admin = await requireAdmin(input.adminId);
      if (admin.id === input.memberId) {
        throw new Error("You can't delete your own account from here.");
      }
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found");
      // Free the email for reuse — clear any signup attempts recorded for it
      await attemptKV.removeItem(`signup:${member.email.toLowerCase()}`);
      // Remove the account
      await memberKV.removeItem(input.memberId);
      // Remove sessions
      const sessionKeys = await sessionKV.getKeys();
      const sessions = await sessionKV.getItems(sessionKeys);
      for (const { key, value } of sessions) {
        if (value.memberId === input.memberId) await sessionKV.removeItem(key);
      }
      // Remove notifications
      const { notificationKV } = await import("./notifications");
      for (const n of await notificationKV.getAllItems()) {
        if (n.memberId === input.memberId) await notificationKV.removeItem(n.id);
      }
      // Remove DMs (both directions)
      const { dmConvoKV, dmMessageKV } = await import("./dms");
      for (const c of await dmConvoKV.getAllItems()) {
        if (c.memberIds.includes(input.memberId)) {
          for (const msg of await dmMessageKV.getAllItems()) {
            if (msg.convoId === c.id) await dmMessageKV.removeItem(msg.id);
          }
          await dmConvoKV.removeItem(c.id);
        }
      }
      // Soft-delete their room messages (keeps threads readable, anonymises author)
      const { messageKV: msgKV } = await import("./community");
      for (const msg of await msgKV.getAllItems()) {
        if (msg.authorId === input.memberId) {
          await msgKV.setItem(msg.id, {
            ...msg,
            text: "",
            deleted: true,
            reactions: {},
            savedBy: [],
          });
        }
      }
      return { ok: true };
    }),

  adminUpdateMember: os
    .input(
      z.object({
        adminId: z.string(),
        memberId: z.string(),
        patch: z.object({
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().nullable().optional(),
          region: z.string().optional(),
          hometown: z.string().optional(),
          diasporaCountry: z.string().optional(),
          church: z.string().optional(),
          profession: z.string().optional(),
          bio: z.string().optional(),
          badges: z.array(z.string()).optional(),
        }),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found");
      // Prevent email collisions
      if (input.patch.email) {
        const all = await memberKV.getAllItems();
        const clash = all.find(
          (m) =>
            m.id !== input.memberId &&
            m.email.toLowerCase() === input.patch.email!.toLowerCase(),
        );
        if (clash) throw new Error("Another member already uses that email");
      }
      const updated = { ...normalizeMember(member), ...input.patch };
      await memberKV.setItem(updated.id, updated);
      return sanitizeMember(updated);
    }),

  setStatus: os
    .input(
      z.object({
        adminId: z.string(),
        memberId: z.string(),
        status: z.enum(["active", "suspended"]),
      }),
    )
    .handler(async ({ input }) => {
      const admin = await requireAdmin(input.adminId);
      if (admin.id === input.memberId) {
        throw new Error("You can't suspend your own account.");
      }
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found");
      const updated = { ...normalizeMember(member), status: input.status };
      await memberKV.setItem(updated.id, updated);
      // Kill active sessions when suspending
      if (input.status === "suspended") {
        const sessionKeys = await sessionKV.getKeys();
        const sessions = await sessionKV.getItems(sessionKeys);
        for (const { key, value } of sessions) {
          if (value.memberId === input.memberId) await sessionKV.removeItem(key);
        }
      }
      await notify(
        input.memberId,
        "system",
        input.status === "suspended" ? "Account suspended" : "Account reactivated",
        input.status === "suspended"
          ? "Your account has been suspended. Contact the administrators if you believe this is a mistake."
          : "Your account is active again. Welcome back!",
      ).catch(() => {});
      return sanitizeMember(updated);
    }),

  setVerified: os
    .input(
      z.object({
        adminId: z.string(),
        memberId: z.string(),
        verified: z.boolean(),
        merchantName: z.string().max(80).optional(),
      }),
    )
    .handler(async ({ input }) => {
      await requireAdmin(input.adminId);
      const member = await memberKV.getItem(input.memberId);
      if (!member) throw new Error("Member not found");
      const updated = {
        ...normalizeMember(member),
        verified: input.verified,
        merchantName: input.verified ? (input.merchantName ?? member.merchantName ?? "") : "",
      };
      await memberKV.setItem(updated.id, updated);
      return sanitizeMember(updated);
    }),

  // Upload a profile photo and/or cover photo (client resizes + compresses to
  // a data URL first). Kept small so member records stay light on the volume.
  uploadImages: os
    .input(
      z.object({
        memberId: z.string(),
        avatarImage: z.string().optional(),
        coverImage: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const member = await requireMember(input.memberId);
      if (input.avatarImage) {
        if (!input.avatarImage.startsWith("data:image/")) throw new Error("Invalid image data");
        if (input.avatarImage.length > 300_000) throw new Error("Profile photo is too large — use a smaller image");
      }
      if (input.coverImage) {
        if (!input.coverImage.startsWith("data:image/")) throw new Error("Invalid image data");
        if (input.coverImage.length > 500_000) throw new Error("Cover photo is too large — use a smaller image");
      }
      const updated: Member = {
        ...normalizeMember(member),
        avatarImage: input.avatarImage !== undefined ? input.avatarImage : (member.avatarImage ?? null),
        coverImage: input.coverImage !== undefined ? input.coverImage : (member.coverImage ?? null),
      };
      await memberKV.setItem(member.id, updated);
      return sanitizeMember(updated);
    }),
};
