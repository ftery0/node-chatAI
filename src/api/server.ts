import {fileURLToPath} from "url";
import path from "path";
import express from "express";
import chalk from "chalk";
import session from "express-session";
import MongoStore from "connect-mongo";
import bcrypt from "bcryptjs";
import {connectDB} from "./db/db.js";
import {UserModel, ChatRoomModel, MessageModel} from "./db/models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// 설정
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const WS_PORT = HTTP_PORT + 1;

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "..", "public")));

// 세션
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/chat-ai";
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7},
    store: MongoStore.create({mongoUrl: MONGODB_URI})
}));

// 서비스 초기화 (API 서버는 AI/WS를 초기화하지 않음)

async function initializeServer() {
    try {
        console.log(chalk.yellow("Starting server initialization..."));
        await connectDB();
        console.log(chalk.green("API services initialized successfully!"));
    } catch (error) {
        console.error(chalk.red("Failed to initialize server:"), error);
        process.exit(1);
    }
}

// 라우트
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "public", "index.html"));
});

app.get("/api/status", (req, res) => {
    res.json({
        status: "running",
        aiServiceReady: false,
        activeSessions: 0,
        activeConnections: 0,
        websocketPort: process.env.AI_WS_PORT ? parseInt(process.env.AI_WS_PORT) : WS_PORT,
        timestamp: new Date().toISOString()
    });
});

app.get("/api/health", (req, res) => {
    res.json({ 
        status: "healthy",
        timestamp: new Date().toISOString()
    });
});

// 인증 라우트
app.post("/api/auth/signup", async (req, res) => {
    try {
        const {email, password, name} = req.body || {};
        if (!email || !password) return res.status(400).json({error: "email, password required"});
        const exists = await UserModel.findOne({email});
        if (exists) return res.status(409).json({error: "email already exists"});
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await UserModel.create({email, passwordHash, name});
        (req.session as any).userId = user._id.toString();
        return res.json({ok: true, user: {id: user._id, email: user.email, name: user.name}});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "signup failed"});
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const {email, password} = req.body || {};
        if (!email || !password) return res.status(400).json({error: "email, password required"});
        const user = await UserModel.findOne({email});
        if (!user) return res.status(401).json({error: "invalid credentials"});
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({error: "invalid credentials"});
        (req.session as any).userId = user._id.toString();
        return res.json({ok: true, user: {id: user._id, email: user.email, name: user.name}});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "login failed"});
    }
});

app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ok: true});
    });
});

app.get("/api/auth/me", async (req, res) => {
    try {
        const userId = (req.session as any).userId;
        if (!userId) return res.json({user: null});
        const user = await UserModel.findById(userId).lean();
        if (!user) return res.json({user: null});
        return res.json({user: {id: user._id, email: user.email, name: user.name}});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "me failed"});
    }
});

// 인증 필요 미들웨어
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({error: "unauthorized"});
    return next();
}

// 채팅방/메시지 API (로그인 사용자만 저장 가능)
app.post("/api/chat/rooms", requireAuth, async (req, res) => {
    try {
        const userId = (req.session as any).userId;
        const {name} = req.body || {};
        const room = await ChatRoomModel.create({userId, name});
        return res.json({ok: true, room: {id: room._id, name: room.name}});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "create room failed"});
    }
});

app.get("/api/chat/rooms", requireAuth, async (req, res) => {
    try {
        const userId = (req.session as any).userId;
        const rooms = await ChatRoomModel.find({userId}).sort({lastMessageAt: -1, createdAt: -1})
            .lean();
        return res.json({rooms: rooms.map((r) => ({id: r._id, name: r.name, createdAt: r.createdAt, lastMessageAt: r.lastMessageAt}))});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "list rooms failed"});
    }
});

app.get("/api/chat/rooms/:roomId/messages", requireAuth, async (req, res) => {
    try {
        const userId = (req.session as any).userId;
        const {roomId} = req.params;
        const room = await ChatRoomModel.findOne({_id: roomId, userId}).lean();
        if (!room) return res.status(404).json({error: "room not found"});
        const messages = await MessageModel.find({roomId}).sort({createdAt: 1})
            .lean();
        return res.json({messages: messages.map((m) => ({id: m._id, role: m.role, content: m.content, createdAt: m.createdAt}))});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "list messages failed"});
    }
});

app.post("/api/chat/rooms/:roomId/messages/user", requireAuth, async (req, res) => {
    try {
        const userId = (req.session as any).userId;
        const {roomId} = req.params;
        const {content} = req.body || {};
        if (!content) return res.status(400).json({error: "content required"});
        const room = await ChatRoomModel.findOne({_id: roomId, userId});
        if (!room) return res.status(404).json({error: "room not found"});
        const msg = await MessageModel.create({roomId, userId, role: "user", content});
        await ChatRoomModel.updateOne({_id: roomId}, {$set: {lastMessageAt: msg.createdAt}});
        return res.json({ok: true, id: msg._id, createdAt: msg.createdAt});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "save user message failed"});
    }
});

app.post("/api/chat/rooms/:roomId/messages/assistant", requireAuth, async (req, res) => {
    try {
        const userId = (req.session as any).userId;
        const {roomId} = req.params;
        const {content} = req.body || {};
        if (!content) return res.status(400).json({error: "content required"});
        const room = await ChatRoomModel.findOne({_id: roomId, userId});
        if (!room) return res.status(404).json({error: "room not found"});
        const msg = await MessageModel.create({roomId, role: "assistant", content});
        await ChatRoomModel.updateOne({_id: roomId}, {$set: {lastMessageAt: msg.createdAt}});
        return res.json({ok: true, id: msg._id, createdAt: msg.createdAt});
    } catch (e: any) {
        return res.status(500).json({error: e.message || "save assistant message failed"});
    }
});

// 에러 처리 미들웨어
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(chalk.red("Express error:"), err);
    res.status(500).json({ 
        error: "Internal server error",
        message: err.message 
    });
});

// 404 처리
app.use((req, res) => {
    res.status(404).json({error: "Not found"});
});

// 서버 시작
async function startServer() {
    await initializeServer();
    
    app.listen(HTTP_PORT, () => {
        console.log(chalk.green(`HTTP Server running on http://localhost:${HTTP_PORT}`));
        console.log(chalk.yellow(`Open your browser and go to http://localhost:${HTTP_PORT}`));
    });
}

// 안전한 종료 처리
process.on("SIGINT", () => {
    console.log(chalk.yellow("\nGracefully shutting down..."));
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log(chalk.yellow("\nGracefully shutting down..."));
    process.exit(0);
});

// 서버 실행
startServer().catch((error) => {
    console.error(chalk.red("Failed to start server:"), error);
    process.exit(1);
});
