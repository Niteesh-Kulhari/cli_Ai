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
import {
  getStoredToken,
  isTokenExpired,
  storeToken,
} from "../../../lib/token.js";

dotenv.config();

const URL = "http://localhost:3001";
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
//console.log("client Id", CLIENT_ID);

export const CONFIG_DIR = path.join(os.homedir(), ".better-auth");
export const TOKEN_FILE = path.join(CONFIG_DIR, "token.json");

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

  const existingToke = await getStoredToken();
  const expired = await isTokenExpired();

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
      process.exit(1);
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
      const urlToOpen = verification_uri_complete || verification_uri;
      await open(urlToOpen);
    }
    if (isCancel(shouldOpen) && !shouldOpen) {
      console.log(chalk.red("Login Cancelled"));
    }

    console.log(
      chalk.gray(
        `Waiting for authorization (expires in ${Math.floor(expires_in / 60)} minutes)`,
      ),
    );
    const token = await pollForToken(authClient, device_code, clientId, 5);
    console.log(token);

    if (token) {
      const saved = await storeToken(token);

      if (!saved) {
        console.log(
          chalk.yellow("\n Warning: Could not save the authentication token"),
        );
        console.log(chalk.yellow("You may need to login agian on next use"));
      }
    }

    outro(chalk.green("Login successfull"));
    console.log(chalk.gray(`\n Token saved to: ${TOKEN_FILE}`));
    console.log(
      chalk.gray("You can use AI commands without logging in again. \n"),
    );
  } catch (error: any) {
    spinner.stop();
    console.error(chalk.red("\n Login Failed"), error.message);
    process.exit(1);
  }
}

async function pollForToken(
  authClient: any,
  deviceCode: string,
  clientId: string,
  initialInterval: number,
) {
  let pollingInterval = initialInterval;
  const spinner = yoctoSpinner({ text: "", color: "cyan" });
  let dots = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      dots = (dots + 1) % 4;
      spinner.text = chalk.gray(
        `Polling for authorization${".".repeat(dots)}${" ".repeat(3 - dots)}`,
      );
      if (!spinner.isSpinning) spinner.start();

      try {
        const { data, error } = await authClient.device.token({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: clientId,
          fetchOptions: {
            headers: {
              "user-agent": `Better Auth CLI`,
            },
          },
        });

        if (data?.access_token) {
          console.log(
            chalk.bold.yellow(`Your access token: ${data.access_token}`),
          );
          spinner.stop();
          resolve(data);
          return;
        } else if (error) {
          switch (error.error) {
            case "authorization_pending":
              // Continue polling
              break;
            case "slow_down":
              pollingInterval += 5;
              break;
            case "access_denied":
              spinner.stop();
              logger.error("Access was denied by the user");
              process.exit(1);
              break;
            case "expired_token":
              spinner.stop();
              logger.error("The device code has expired. Please try again.");
              process.exit(1);
              break;
            default:
              spinner.stop();
              logger.error(`Error: ${error.error_description}`);
              process.exit(1);
          }
        }
      } catch (err: any) {
        spinner.stop();
        logger.error(`Network error: ${err.message}`);
        process.exit(1);
      }

      setTimeout(poll, pollingInterval * 1000);
    };

    setTimeout(poll, pollingInterval * 1000);
  });
}

export const login = new Command("login")
  .description("Login to Better Auth")
  .option("--server-url <url>", "Better Auth server URL", URL)
  .option("--client-id <id>", "OAuth client ID", CLIENT_ID)
  .action(loginAction);
