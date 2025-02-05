const net = require('net');
const express = require('express');
const cors = require('cors');
const app = express();

// 启用CORS
app.use(cors());

// 创建到KataGo的连接
const katagoClient = new net.Socket();
katagoClient.connect(6060, 'localhost', () => {
    console.log('已连接到KataGo服务');
});

// 处理来自KataGo的响应
let responseBuffer = '';
katagoClient.on('data', (data) => {
    responseBuffer += data.toString();
    if (responseBuffer.includes('\n\n')) {
        console.log('收到KataGo响应:', responseBuffer);
        // 处理响应...
        responseBuffer = '';
    }
});

// API端点处理落子请求
app.post('/api/move', express.json(), (req, res) => {
    const { board } = req.body;
    
    // 将棋盘状态转换为GTP命令
    const command = formatGTPCommand(board);
    
    // 发送命令到KataGo
    katagoClient.write(command + '\n');
    
    // 等待并返回响应
    // 这里需要实现适当的响应处理机制
    res.json({ success: true, move: { x: 3, y: 4 } });
});

function formatGTPCommand(board) {
    // 将棋盘状态转换为GTP命令格式
    return `genmove white`;
}

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
}); 