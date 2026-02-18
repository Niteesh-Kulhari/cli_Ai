#!/usr/bin/env node

import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";

import { Command } from "commander";
import { login } from "./commands/auth/login.js";

dotenv.config();

async function main() {
  //Display Banner
  console.log(
    chalk.cyan(
      figlet.textSync("Cli Ai", {
        font: "Standard",
        horizontalLayout: "default",
      }),
    ),
  );

  console.log(chalk.red("A CLI based Ai tool \n"));

  const program = new Command("cli");
  program
    .version("0.0.1")
    .description("CLI AI - Cli based AI tool")
    .addCommand(login);

  program.action(() => {
    program.help();
  });

  program.parse();
}

main().catch((err) => {
  console.log(chalk.red("Error running CLI AI"), err);
  process.exit(1);
});
