const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = require('http').createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// PostgreSQL 連接設置
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// 創建用戶表
async function initDatabase() {
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                is_online BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Database initialized');
        client.release();
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

initDatabase();

// Socket.io 連接處理
io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    // 註冊處理
    socket.on('register', async (data) => {
        try {
            const { username, password } = data;
            const client = await pool.connect();
            
            // 檢查用戶是否存在
            const existingUser = await client.query(
                'SELECT * FROM users WHERE username = $1',
                [username]
            );

            if (existingUser.rows.length > 0) {
                socket.emit('registerError', '用戶名已存在');
                client.release();
                return;
            }

            // 創建新用戶
            await client.query(
                'INSERT INTO users (username, password, is_admin) VALUES ($1, $2, $3)',
                [username, password, username === 'billxiaobai']
            );

            socket.emit('registerSuccess', { username });
            io.emit('updateUserList');
            client.release();
        } catch (error) {
            socket.emit('registerError', error.message);
        }
    });

    // 登入處理
    socket.on('login', async (data) => {
        try {
            const { username, password } = data;
            const client = await pool.connect();
            
            const result = await client.query(
                'SELECT * FROM users WHERE username = $1 AND password = $2',
                [username, password]
            );

            if (result.rows.length > 0) {
                await client.query(
                    'UPDATE users SET is_online = true WHERE username = $1',
                    [username]
                );
                
                socket.emit('loginSuccess', {
                    username,
                    isAdmin: result.rows[0].is_admin
                });
                io.emit('updateUserList');
            } else {
                socket.emit('loginError', '帳號或密碼錯誤');
            }
            
            client.release();
        } catch (error) {
            socket.emit('loginError', error.message);
        }
    });

    // 獲取在線用戶
    socket.on('getOnlineUsers', async () => {
        try {
            const client = await pool.connect();
            const result = await client.query(
                'SELECT username, is_admin FROM users WHERE is_online = true'
            );
            socket.emit('onlineUsers', result.rows);
            client.release();
        } catch (error) {
            console.error('Error getting online users:', error);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});