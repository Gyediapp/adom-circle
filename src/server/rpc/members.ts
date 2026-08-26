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
  following: z.array(z.string()),
  followerCount: z.number(),
  savedMessages: z.array(z.string()),
  status: z.enum(["active", "suspended"]),
});

export type Member = z.output<typeof MemberSchema>;
export type MemberRole = Member["role"];

// Stored members created before these fields existed — fill safe defaults
export function normalizeMember(m: Member): Member {
  return {
    ...m,
    following: m.following ?? [],
    followerCount: m.followerCount ?? 0,
    savedMessages: m.savedMessages ?? [],
    status: m.status ?? "active",
  };
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
  return memberKV.getItem(s.memberId);
}

// ---------- Email sending (demo outbox; swap for SMTP in production) ----------
// In production, replace the body of sendEmail with a real provider call
// (Resend / Postmark / SMTP via nodemailer). The outbox doubles as a dev inbox
// so flows are testable without a mail server.

const CODE_TTL_MS = 1000 * 60 * 60 * 24; // verification codes: 24h
const RESET_TTL_MS = 1000 * 60 * 30; // reset codes: 30 min

function makeCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  debugCode: string | null;
}): Promise<OutboxEmail> {
  const email: OutboxEmail = {
    id: randomUUID(),
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    debugCode: opts.debugCode,
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
      };
      await memberKV.setItem(member.id, member);
      await sendEmail({
        to: member.email,
        subject: "Verify your Adom Circle email",
        body: `Your verification code is: ${code}\n\nEnter it on the site to activate your account. It expires in 24 hours.`,
        debugCode: code,
      });
      await recordAttempt(`signup:${input.email.toLowerCase()}`);
      return { member: sanitizeMember(member), devCode: code };
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
      await sendEmail({
        to: updated.email,
        subject: "Verify your Adom Circle email (new code)",
        body: `Your new verification code is: ${code}\n\nIt expires in 24 hours.`,
        debugCode: code,
      });
      return { devCode: code };
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
      let code: string | null = null;
      if (found) {
        code = makeCode();
        const updated = {
          ...found,
          resetToken: code,
          resetExpires: new Date(Date.now() + RESET_TTL_MS).toISOString(),
        };
        await memberKV.setItem(updated.id, updated);
        await sendEmail({
          to: updated.email,
          subject: "Reset your Adom Circle password",
          body: `Your password reset code is: ${code}\n\nIt expires in 30 minutes. Never share it with anyone.`,
          debugCode: code,
        });
      }
      await recordAttempt(key);
      return { devCode: code };
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
      return { ok: true };
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
      .map(sanitizeMember);
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
};
