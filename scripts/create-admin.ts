import "./_env";
import { createInterface } from "node:readline";
import { generateSecret, generateURI } from "otplib";
import { z } from "zod";
import { hashPassword } from "@/server/auth/password";
import { closeDb } from "@/server/db/client";
import { col } from "@/server/db/collections";

/*
  Create or reset an admin console account (email + password + TOTP).
    npm run create-admin -- <email> "<name>" <role> [--print-secret]
    npm run create-admin -- --email a@b.com --name "Rohan" --role admin      (flag form also works)
  Roles: admin | agronomist | analyst | dealer_manager.
  The password is read from KK_ADMIN_PASSWORD, or asked for (hidden) on the terminal.
  Prints the otpauth:// URL once: add it to Google Authenticator (paste it or make a QR).
  --print-secret also prints the raw base32 TOTP secret (for automated tests only).
  Re-running for an existing email resets its password AND its TOTP secret.
*/

const Args = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  name: z.string().min(1),
  role: z.enum(["admin", "agronomist", "analyst", "dealer_manager"]),
});

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function positional(): string[] {
  const out: string[] = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--print-secret") continue;
    if (argv[i].startsWith("--")) {
      i++; // skip the flag's value
      continue;
    }
    out.push(argv[i]);
  }
  return out;
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const mutable = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    mutable._writeToOutput = (s: string) => {
      if (!muted || s.includes("\n")) mutable.output.write(muted ? "\n" : s);
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const [pEmail, pName, pRole] = positional();
  const { email, name, role } = Args.parse({
    email: flag("email") ?? pEmail,
    name: flag("name") ?? pName,
    role: flag("role") ?? pRole ?? "admin",
  });
  const password = process.env.KK_ADMIN_PASSWORD || (await askHidden("Password (min 12 chars): "));
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");

  const totpSecret = generateSecret();
  const admins = await col("admins");
  await admins.updateOne(
    { _id: email },
    {
      $set: { name, role, passwordHash: await hashPassword(password), totpSecret },
      $unset: { lastTotpStep: "" },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  console.log(`\nAdmin ${email} (${role}) saved.`);
  console.log("Add this to Google Authenticator (shown once):");
  console.log(generateURI({ issuer: "Kaththokra", label: email, secret: totpSecret }));
  if (process.argv.includes("--print-secret")) console.log(`TOTP secret: ${totpSecret}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
