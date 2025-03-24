require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const User = require('./models/User');

const app = express();
const server = require('http').createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 中間件
app.use(cors());
app.use(express.json());

// 系統時間
const SYSTEM_TIME = "2025-03-24 13:30:45";

// MongoDB 連接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xibot-auth');

// 基本路由
app.get('/', (req, res) => {
    res.json({ status: 'running', time: SYSTEM_TIME });
});

// Socket.io 連接處理
io.on('connection', (socket) => {
    console.log('用戶連接:', socket.id);

    // 註冊處理
    socket.on('register', async (data) => {
        try {
            const { username, password } = data;
            const existingUser = await User.findOne({ username });
            
            if (existingUser) {
                socket.emit('registerError', '用戶名已存在');
                return;
            }

            const user = new User({
                username,
                password,
                isAdmin: username === 'billxiaobai', // 特別處理您的帳號
                isOnline: true
            });

            await user.save();
            socket.emit('registerSuccess', { username });
            io.emit('updateUserList');
        } catch (error) {
            socket.emit('registerError', error.message);
        }
    });

    // 獲取在線用戶列表
    socket.on('getOnlineUsers', async () => {
        const users = await User.find({ isOnline: true }, 'username isAdmin');
        socket.emit('onlineUsers', users);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器運行在端口 ${PORT}`);
});