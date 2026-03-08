import chalk from "chalk";
import { CONFIG_DIR, TOKEN_FILE } from "../cli/commands/auth/login.js";
import fs from "fs/promises";

interface token {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  scope: string;
  expires_in: number;
}

export async function getStoredToken() {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf-8");
    const token = JSON.parse(data);
    return token;
  } catch (error) {
    return null;
  }
}

// interface token {
//   access_token: string;
//   refresh_token: string;
//   token_type?: string;
//   scope: string;
//   expires_in: number;
// }

export async function storeToken(token: any) {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });

    const tokenData = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_type: token.token_type || "Bearer",
      scope: token.scope,
      expires_at: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null,
      created_at: new Date().toISOString(),
    };

    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 2), "utf-8");
    return true;
  } catch (error: any) {
    console.error(chalk.red("Failed to store token:", error.message));
    return false;
  }
}

export async function cleareStoredToken() {
  try {
    await fs.unlink(TOKEN_FILE);
    return true;
  } catch (error) {
    return false;
  }
}

export async function isTokenExpired() {
  const token = await getStoredToken();

  if (!token || !token.expires_at) {
    return true;
  }

  const expires_at = new Date(token.expires_at);
  const now = new Date();

  return expires_at.getTime() - now.getTime() < 5 * 60 * 1000;
}

export async function requiredAuth() {
  const token = getStoredToken();

  if (!token) {
    console.log(
      chalk.red("Not Authenticated, Please run 'your-cli login' first"),
    );
    process.exit(1);
  }

  if (await isTokenExpired()) {
    console.log(chalk.yellow("Your Session has expired. Please Login again"));
    console.log(chalk.gray("Run: cliAi login \n"));
    process.exit(1);
  }
  return token;
}
