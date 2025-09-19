import {mongoose} from "./db.js";

const {Schema} = mongoose;

// User
const UserSchema = new Schema({
    email: {type: String, required: true, unique: true, index: true},
    passwordHash: {type: String, required: true},
    name: {type: String},
    createdAt: {type: Date, default: Date.now}
});

export const UserModel = mongoose.model("User", UserSchema);

// ChatRoom
const ChatRoomSchema = new Schema({
    name: {type: String},
    userId: {type: Schema.Types.ObjectId, ref: "User", required: true, index: true},
    createdAt: {type: Date, default: Date.now},
    lastMessageAt: {type: Date}
});

export const ChatRoomModel = mongoose.model("ChatRoom", ChatRoomSchema);

// Message
const MessageSchema = new Schema({
    roomId: {type: Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true},
    userId: {type: Schema.Types.ObjectId, ref: "User"},
    role: {type: String, enum: ["user", "assistant", "system"], required: true},
    content: {type: String, required: true},
    createdAt: {type: Date, default: Date.now}
});

export const MessageModel = mongoose.model("Message", MessageSchema);


