import mongoose from "mongoose";

export async function connectDB() {
    try {
        const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/chat-ai";
        const dbName = process.env.MONGODB_DB || "chat-ai";
        await mongoose.connect(uri, { dbName });
        console.log("✅ MongoDB connected");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
}

export { mongoose };
