import chalk from "chalk";
import {aiService} from "./services/aiService.js";
import {WebSocketHandler} from "./services/WebSocketHandler.js";

async function startAIServer() {
    try {
        console.log(chalk.yellow("Initializing AI Server..."));
        await aiService.initialize();

        const WS_PORT = process.env.AI_WS_PORT ? parseInt(process.env.AI_WS_PORT) : 3001;
        new WebSocketHandler(WS_PORT);

        console.log(chalk.green(`AI WebSocket Server running on ws://localhost:${WS_PORT}`));
    } catch (error) {
        console.error(chalk.red("Failed to start AI server:"), error);
        process.exit(1);
    }
}

startAIServer();


