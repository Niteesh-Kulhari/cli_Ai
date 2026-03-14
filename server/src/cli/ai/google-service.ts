import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { config } from "../../config/google.config.js";
import chalk from "chalk";

export class AIService {
  model;
  constructor() {
    if (!config.googleApiKey) {
      throw new Error("Google_API_KEY is not configured in env");
    }

    this.model = google(config.model);
  }

  /**
   *  Send a message and get streaming responser
   *  @param {Array} messages
   *  @param {Function} onChunk
   *  @param {Object} tools
   *  @param {Function} onToolCall
   *  @returns {Promise<Object>}
   */

  async sendMessage(
    messages: any,
    onChunk: any,
    tools = undefined,
    onToolCall = null,
  ) {
    try {
      const streamConfig = {
        model: this.model,
        messages: messages,
      };

      const result = streamText(streamConfig);

      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const fullResult = result;

      return {
        content: fullResponse,
        finishResponse: fullResult.finishReason,
        usage: result.usage,
      };
    } catch (error: any) {
      console.error(chalk.red("AI Service error: "), error.message);
      throw error;
    }
  }

  /**
   * Get a non-streaming response
   * @param {Array} messages - Array of message objects
   * @param {Object} tools - Optionals tools
   * @returns {Promise<string>} Response text
   */

  async getMessage(message: any, tools = undefined) {
    let fullResponse = "";
    await this.sendMessage(message, (chunk: any) => {
      fullResponse += chunk;
    });
    return fullResponse;
  }
}
