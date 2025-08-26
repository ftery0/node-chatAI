import {WebSocket, WebSocketServer} from "ws";
import {v4 as uuidv4} from "uuid";
import chalk from "chalk";
import {aiService} from "./aiService.js";

export interface WebSocketMessage {
    type: "message" | "ping" | "session_create" | "session_delete",
    sessionId?: string,
    content?: string,
    timestamp?: string
}

export interface WebSocketResponse {
    type: "message" | "chunk" | "error" | "session_created" | "pong" | "status",
    sessionId?: string,
    content?: string,
    error?: string,
    timestamp?: string,
    isComplete?: boolean
}

export class WebSocketHandler {
    private wss: WebSocketServer;
    private connections: Map<string, WebSocket> = new Map();

    constructor(port: number) {
        this.wss = new WebSocketServer({port});
        this.setupWebSocketServer();
        console.log(chalk.blue(`WebSocket server listening on port ${port}`));
    }

    private setupWebSocketServer() {
        this.wss.on("connection", (ws: WebSocket) => {
            const connectionId = uuidv4();
            this.connections.set(connectionId, ws);
            
            console.log(chalk.green(`WebSocket client connected: ${connectionId}`));

            // Send initial status
            this.sendToClient(ws, {
                type: "status",
                content: aiService.isReady() ? "AI Service is ready" : "AI Service is initializing...",
                timestamp: new Date().toISOString()
            });

            ws.on("message", async (data: Buffer) => {
                try {
                    const message: WebSocketMessage = JSON.parse(data.toString());
                    await this.handleMessage(ws, message, connectionId);
                } catch (error) {
                    console.error(chalk.red("Error parsing WebSocket message:"), error);
                    this.sendError(ws, "Invalid message format");
                }
            });

            ws.on("close", () => {
                console.log(chalk.yellow(`WebSocket client disconnected: ${connectionId}`));
                this.connections.delete(connectionId);
            });

            ws.on("error", (error) => {
                console.error(chalk.red(`WebSocket error for ${connectionId}:`), error);
                this.connections.delete(connectionId);
            });
        });
    }

    private async handleMessage(ws: WebSocket, message: WebSocketMessage, connectionId: string) {
        const {type, sessionId, content} = message;

        try {
            switch (type) {
                case "ping":
                    this.sendToClient(ws, {type: "pong", timestamp: new Date().toISOString()});
                    break;

                case "session_create":
                    try {
                        const newSessionId = sessionId || uuidv4();
                        
                        // Check if we can create a new session
                        const sessionsCount = aiService.getSessionsCount();
                        if (sessionsCount >= 4) { // Match the limit in AIService
                            this.sendError(ws, "Maximum number of concurrent sessions reached. Please try again later.");
                            return;
                        }
                        
                        await aiService.createSession(newSessionId);
                        this.sendToClient(ws, {
                            type: "session_created",
                            sessionId: newSessionId,
                            timestamp: new Date().toISOString()
                        });
                    } catch (error) {
                        console.error(chalk.red("Failed to create session:"), error);
                        this.sendError(ws, error instanceof Error ? error.message : "Failed to create session");
                    }
                    break;

                case "session_delete":
                    if (sessionId) {
                        const deleted = aiService.deleteSession(sessionId);
                        this.sendToClient(ws, {
                            type: "status",
                            content: deleted ? "Session deleted" : "Session not found",
                            timestamp: new Date().toISOString()
                        });
                    }
                    break;

                case "message":
                    if (!sessionId || !content) {
                        this.sendError(ws, "Session ID and content are required");
                        return;
                    }

                    if (!aiService.isReady()) {
                        this.sendError(ws, "AI Service is not ready yet");
                        return;
                    }

                    console.log(chalk.blue(`[${connectionId}] Processing message for session ${sessionId}`));

                    // Send streaming chunks
                    let fullResponse = "";
                    await aiService.sendMessage(sessionId, content, (chunk: string) => {
                        fullResponse += chunk;
                        this.sendToClient(ws, {
                            type: "chunk",
                            sessionId,
                            content: chunk,
                            timestamp: new Date().toISOString(),
                            isComplete: false
                        });
                    });

                    // Send completion message
                    this.sendToClient(ws, {
                        type: "message",
                        sessionId,
                        content: fullResponse,
                        timestamp: new Date().toISOString(),
                        isComplete: true
                    });
                    break;

                default:
                    this.sendError(ws, `Unknown message type: ${type}`);
            }
        } catch (error) {
            console.error(chalk.red(`Error handling message type ${type}:`), error);
            this.sendError(ws, `Error processing ${type}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    private sendToClient(ws: WebSocket, response: WebSocketResponse) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(response));
        }
    }

    private sendError(ws: WebSocket, error: string) {
        this.sendToClient(ws, {
            type: "error",
            error,
            timestamp: new Date().toISOString()
        });
    }

    public broadcast(message: WebSocketResponse) {
        this.connections.forEach((ws) => {
            this.sendToClient(ws, message);
        });
    }

    public getConnectionsCount(): number {
        return this.connections.size;
    }
}
