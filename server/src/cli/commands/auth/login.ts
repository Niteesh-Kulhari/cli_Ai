import { cancel, confirm, intro, isCancel, outro } from "@clack/prompts";
import { logger } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

import chalk from "chalk";
import { Command } from "commander";
import fs from "fs/promises";
import open from "open";
import os from "os";
import path from "path";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod";
import dotenv from "dotenv";
import prisma from "../../../lib/db";

dotenv.config();

const URL = "http://localhost:3001";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
//console.log("client Id", CLIENT_ID);

const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

export async function loginAction(opts = {}) {
  const schema = z.object({
    serverUrl: z.string().optional(),
    clientId: z.string().optional(),
  });

  const options = schema.parse(opts);

  const serverUrl = options.serverUrl ?? URL;
  const clientId = options.clientId ?? CLIENT_ID;

  if (!clientId) {
    console.error("❌ GITHUB_CLIENT_ID is not set");
    process.exit(1);
  }

  intro(chalk.bold("🔐 Auth Cli Login"));

  const existingToke = false;
  const expired = false;

  if (existingToke && !expired) {
    const shouldReAuth = await confirm({
      message: "You are already Logged In do you want to login again?",
      initialValue: false,
    });

    if (isCancel(shouldReAuth) || !shouldReAuth) {
      cancel("Login Cancelled");
      process.exit(0);
    }
  }

  const authClient = createAuthClient({
    baseURL: serverUrl,
    plugins: [deviceAuthorizationClient()],
  });

  const spinner = yoctoSpinner({ text: "Requesting Device Authorization..." });
  spinner.start();

  try {
    const { data, error } = await authClient.device.code({
      client_id: clientId,
      scope: "openid email profile",
    });

    spinner.stop();

    if (error || !data) {
      logger.error(
        `Failed to request device authorization code ${error.error_description}`,
      );
    }
    if (!data) {
      logger.error("No device authorization data returned");
      return;
    }

    const {
      device_code,
      user_code,
      verification_uri,
      verification_uri_complete,
      expires_in,
      interval = 5,
    } = data;
    console.log(chalk.cyan("Device Authorization Required"));
    console.log(
      `Please visit ${chalk.underline.blue(verification_uri || verification_uri_complete)}`,
    );
    console.log(`Enter Code: ${chalk.bold.green(user_code)}`);
    const shouldOpen = await confirm({
      message: "Open browser automatically",
      initialValue: true,
    });

    if (!isCancel(shouldOpen) && shouldOpen) {
      const urlToOpen = verification_uri || verification_uri_complete;
      await open(urlToOpen);
    }

    console.log(
      chalk.gray(
        `Waiting for authorization (expires in ${Math.floor(expires_in / 60)} minutes)`,
      ),
    );

    process.exit(1);
  } catch (error) {}
}

export const login = new Command("login")
  .description("Login to Better Auth")
  .option("--server-url <url>", "Better Auth server URL", URL)
  .option("--client-id <id>", "OAuth client ID", CLIENT_ID)
  .action(loginAction);
