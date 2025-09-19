import {fileURLToPath} from "url";
import path from "path";
import chalk from "chalk";
import {getLlama, LlamaChatSession, resolveModelFile, LlamaModel, LlamaContext} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDirectory = path.join(__dirname, "..", "..", "models");

export interface ChatSession {
    id: string,
    session: LlamaChatSession,
    context: LlamaContext,
    createdAt: Date,
    lastUsed: Date
}

class AIService {
    private llama: any = null;
    private model: LlamaModel | null = null;
    private sessions: Map<string, ChatSession> = new Map();
    private isInitialized = false;
    private maxConcurrentSessions = 4; // 토큰 제한

    public async initialize() {
        if (this.isInitialized) return;

        try {
            console.log(chalk.yellow("Initializing AI Service..."));
            
            // Llama 초기화

            this.llama = await getLlama();
            console.log(chalk.yellow("Resolving model file..."));
            
            const modelPath = await resolveModelFile(
                "hf:giladgd/gpt-oss-20b-GGUF/gpt-oss-20b.MXFP4.gguf",
                modelsDirectory
            );
            
            console.log(chalk.yellow("Loading model..."));
            this.model = await this.llama.loadModel({modelPath});

            this.isInitialized = true;
            console.log(chalk.green("AI Service initialized successfully!"));
            console.log(chalk.cyan(`Maximum concurrent sessions: ${this.maxConcurrentSessions}`));
            
            // 일정 주기로 오래된 세션 정리
            setInterval(() => this.cleanupOldSessions(), 30 * 60 * 1000); // 30 minutes
        } catch (error) {
            console.error(chalk.red("Failed to initialize AI Service:"), error);
            throw error;
        }
    }

    public async createSession(sessionId: string): Promise<ChatSession> {
        if (!this.isInitialized || !this.model) {
            throw new Error("AI Service not initialized");
        }

        // 세션 개수 제한 확인
        if (this.sessions.size >= this.maxConcurrentSessions) {
            throw new Error(`Maximum concurrent sessions (${this.maxConcurrentSessions}) reached`);
        }

        // 세션이 이미 존재하는지 확인
        if (this.sessions.has(sessionId)) {
            console.log(chalk.yellow(`Session ${sessionId} already exists, returning existing session`));
            return this.sessions.get(sessionId)!;
        }

        try {
            console.log(chalk.blue(`Creating new session: ${sessionId}`));
            
            // 메모리 사용 줄이기 위해 작은 크기의 컨텍스트 생성
            const sessionContext = await this.model.createContext({
                contextSize: {max: 4096} // 줄인 컨텍스트 크기
            });

            console.log(chalk.gray(`Context created for session ${sessionId}`));

            const session = new LlamaChatSession({
                contextSequence: sessionContext.getSequence()
            });

            const chatSession: ChatSession = {
                id: sessionId,
                session,
                context: sessionContext,
                createdAt: new Date(),
                lastUsed: new Date()
            };

            this.sessions.set(sessionId, chatSession);
            console.log(chalk.blue(`Created new chat session: ${sessionId} (${this.sessions.size}/${this.maxConcurrentSessions})`));
            
            return chatSession;
        } catch (error) {
            console.error(chalk.red(`Failed to create session ${sessionId}:`), error);
            throw new Error(`Failed to create session: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    public getSession(sessionId: string): ChatSession | null {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastUsed = new Date();
        }
        return session || null;
    }

    public async sendMessage(
        sessionId: string, 
        message: string,
        onChunk?: (chunk: string) => void
    ): Promise<string> {
        let session = this.getSession(sessionId);
        
        if (!session) {
            session = await this.createSession(sessionId);
        }

        try {
            console.log(chalk.blue(`[${sessionId}] User: ${message}`));
            
            const response = await session.session.prompt(message, {
                onResponseChunk: onChunk ? (chunk) => {
                    if (chunk.text) {
                        onChunk(chunk.text);
                    }
                } : undefined
            });

            console.log(chalk.green(`[${sessionId}] AI: ${response}`));
            return response;
        } catch (error) {
            console.error(chalk.red(`Error processing message for session ${sessionId}:`), error);
            throw error;
        }
    }

    public deleteSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (session) {
            // 리소스를 해제하기 위해 컨텍스트 dispose
            try {
                console.log(chalk.gray(`Disposing context for session ${sessionId}`));
                session.context.dispose();
            } catch (error) {
                console.warn(chalk.yellow(`Warning: Failed to dispose context for session ${sessionId}:`), error);
            }
        }
        
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            console.log(chalk.yellow(`Deleted session: ${sessionId} (${this.sessions.size}/${this.maxConcurrentSessions})`));
        }
        return deleted;
    }

    private cleanupOldSessions() {
        const now = new Date();
        const maxAge = 60 * 60 * 1000; // 1시간

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now.getTime() - session.lastUsed.getTime() > maxAge) {
                this.deleteSession(sessionId);
            }
        }
        
        console.log(chalk.gray(`Session cleanup completed. Active sessions: ${this.sessions.size}`));
    }

    public getSessionsCount(): number {
        return this.sessions.size;
    }

    public isReady(): boolean {
        return this.isInitialized;
    }

    public getMaxConcurrentSessions(): number {
        return this.maxConcurrentSessions;
    }
}

export const aiService = new AIService();
