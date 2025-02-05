class GoGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // 设置棋盘大小和边距
        this.boardSize = 19;
        this.cellSize = Math.floor((this.canvas.width - 40) / this.boardSize);
        this.margin = Math.floor((this.canvas.width - (this.boardSize - 1) * this.cellSize) / 2);
        
        // 初始化棋盘状态
        this.currentPlayer = 'black';
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.moveHistory = [];
        this.koPoint = null;
        this.lastMove = null;
        this.capturedStones = { black: 0, white: 0 };
        this.ai = new GoAI(this);
        this.aiRankSelect = document.getElementById('ai-rank');
        
        // 添加事件监听器
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        document.getElementById('pass').addEventListener('click', () => this.pass());
        document.getElementById('resign').addEventListener('click', () => this.resign());
        document.getElementById('analyze').addEventListener('click', () => this.analyzePosition());
        
        // 创建领地显示层
        this.territoryCanvas = document.createElement('canvas');
        this.territoryCanvas.width = this.canvas.width;
        this.territoryCanvas.height = this.canvas.height;
        this.territoryCanvas.className = 'territory-overlay';
        this.canvas.parentElement.appendChild(this.territoryCanvas);
        
        // 初始绘制棋盘
        this.drawBoard();
        this.updateScore();
    }

    drawBoard() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 设置棋盘背景色
        this.ctx.fillStyle = '#DCB35C';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格线
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        
        // 绘制横线和竖线
        for (let i = 0; i < this.boardSize; i++) {
            // 横线
            this.ctx.moveTo(this.margin, this.margin + i * this.cellSize);
            this.ctx.lineTo(this.margin + (this.boardSize - 1) * this.cellSize, this.margin + i * this.cellSize);
            // 竖线
            this.ctx.moveTo(this.margin + i * this.cellSize, this.margin);
            this.ctx.lineTo(this.margin + i * this.cellSize, this.margin + (this.boardSize - 1) * this.cellSize);
        }
        this.ctx.stroke();
        
        // 绘制星位 - 修改为正确的位置
        const starPoints = [3, 9, 15];  // 对应4-4, 天元和16-16的位置
        for (let i of starPoints) {
            for (let j of starPoints) {
                this.drawStar(i, j);
            }
        }
        
        // 绘制棋子
        this.drawStones();
        
        // 绘制最后一手的标记
        if (this.lastMove) {
            this.drawLastMoveMarker(this.lastMove.x, this.lastMove.y);
        }
    }

    drawStar(x, y) {
        this.ctx.beginPath();
        this.ctx.fillStyle = '#000';
        // 修改星位点的半径为3像素
        const radius = 3;
        // 修正坐标计算，使用margin和cellSize
        const centerX = this.margin + x * this.cellSize;
        const centerY = this.margin + y * this.cellSize;
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawStones() {
        for (let y = 0; y < this.boardSize; y++) {
            for (let x = 0; x < this.boardSize; x++) {
                if (this.board[y][x]) {
                    this.drawStone(x, y, this.board[y][x]);
                }
            }
        }
    }

    drawStone(x, y, color) {
        const centerX = this.margin + x * this.cellSize;
        const centerY = this.margin + y * this.cellSize;
        const radius = this.cellSize * 0.45; // 稍微小于格子的一半
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        
        // 设置渐变效果
        const gradient = this.ctx.createRadialGradient(
            centerX - radius/3, centerY - radius/3, radius/10,
            centerX, centerY, radius
        );
        
        if (color === 'black') {
            gradient.addColorStop(0, '#666');
            gradient.addColorStop(1, '#000');
        } else {
            gradient.addColorStop(0, '#fff');
            gradient.addColorStop(1, '#ccc');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // 添加边框
        this.ctx.strokeStyle = color === 'black' ? '#000' : '#ccc';
        this.ctx.stroke();
    }

    drawLastMoveMarker(x, y) {
        const centerX = this.margin + x * this.cellSize;
        const centerY = this.margin + y * this.cellSize;
        
        // 绘制小三角形
        this.ctx.beginPath();
        this.ctx.fillStyle = this.board[y][x] === 'black' ? '#fff' : '#000';
        
        // 计算三角形的三个顶点
        const size = this.cellSize * 0.2;  // 三角形大小
        this.ctx.moveTo(centerX, centerY - size);  // 顶点
        this.ctx.lineTo(centerX - size * 0.866, centerY + size * 0.5);  // 左下
        this.ctx.lineTo(centerX + size * 0.866, centerY + size * 0.5);  // 右下
        this.ctx.closePath();
        
        this.ctx.fill();
    }

    handleClick(e) {
        if (this.currentPlayer === 'white') return; // 如果是AI回合，不响应点击
        
        // 获取点击相对于canvas的位置
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 计算最近的交叉点
        const gridX = Math.round((x - this.margin) / this.cellSize);
        const gridY = Math.round((y - this.margin) / this.cellSize);
        
        // 检查是否在有效范围内
        if (gridX >= 0 && gridX < this.boardSize && 
            gridY >= 0 && gridY < this.boardSize && 
            !this.board[gridY][gridX]) {
            
            this.makeMove(gridX, gridY);
            
            // 如果落子成功，切换到AI回合
            setTimeout(() => this.aiMove(), 500);
        }
    }

    makeMove(x, y) {
        if (x >= 0 && x < this.boardSize && 
            y >= 0 && y < this.boardSize && 
            !this.board[y][x]) {
            
            this.board[y][x] = this.currentPlayer;
            this.lastMove = {x, y};  // 记录最后一手
            this.moveHistory.push({x, y});
            this.drawBoard();
            this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
            return true;
        }
        return false;
    }

    async aiMove() {
        console.log('AI回合开始');
        const rank = this.aiRankSelect.value;
        try {
            const response = await fetch('http://localhost:8001/api/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    board: this.getBoardState(),
                    rank: rank
                })
            });

            const data = await response.json();
            if (data.success && data.move) {
                console.log(`AI准备在 (${data.move.x}, ${data.move.y}) 落子`);
                this.makeMove(data.move.x, data.move.y);  // 这里会自动更新 lastMove
            } else {
                console.log('AI选择停一手');
                this.pass();
            }
        } catch (error) {
            console.error('AI落子出错:', error);
            this.pass();
        }
    }

    pass() {
        if (this.moveHistory.length > 0 && this.moveHistory[this.moveHistory.length - 1].pass) {
            this.endGame();
        } else {
            this.moveHistory.push({pass: true});
            this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
            if (this.currentPlayer === 'white') {
                setTimeout(() => this.aiMove(), 500);
            }
        }
    }

    resign() {
        const winner = this.currentPlayer === 'black' ? '白' : '黑';
        alert(`${winner}棋胜！`);
        this.resetGame();
    }

    updateScore() {
        const score = document.getElementById('score');
        if (score) {
            score.textContent = 
                `黑方提子：${this.capturedStones.black} 目\n` +
                `白方提子：${this.capturedStones.white} 目`;
        }
    }

    resetGame() {
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.moveHistory = [];
        this.koPoint = null;
        this.lastMove = null;
        this.capturedStones = {black: 0, white: 0};
        this.drawBoard();
        this.updateScore();
    }

    hasLiberties(x, y, visited = new Set()) {
        const key = `${x},${y}`;
        if (visited.has(key)) return false;
        visited.add(key);

        const color = this.board[y][x];
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];

        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;

            if (newX >= 0 && newX < this.boardSize && newY >= 0 && newY < this.boardSize) {
                if (!this.board[newY][newX]) return true; // 空位就是气
                if (this.board[newY][newX] === color && this.hasLiberties(newX, newY, visited)) {
                    return true;
                }
            }
        }

        return false;
    }

    getCapturedStones(x, y, color) {
        const captured = [];
        const oppositeColor = color === 'black' ? 'white' : 'black';
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];

        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;

            if (newX >= 0 && newX < this.boardSize && newY >= 0 && newY < this.boardSize) {
                if (this.board[newY][newX] === oppositeColor && !this.hasLiberties(newX, newY)) {
                    // 如果对方棋子没有气，记录被提子的棋子
                    this.getGroup(newX, newY, captured);
                }
            }
        }

        return captured;
    }

    getGroup(x, y, captured) {
        const queue = [[x, y]];
        const visited = new Set();

        while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            visited.add(key);

            captured.push(key); // 记录被提子的棋子

            const directions = [[1,0], [-1,0], [0,1], [0,-1]];
            for (const [dx, dy] of directions) {
                const newX = cx + dx;
                const newY = cy + dy;

                if (newX >= 0 && newX < this.boardSize && newY >= 0 && newY < this.boardSize) {
                    if (this.board[newY][newX] === 'white') {
                        queue.push([newX, newY]); // 继续查找同色棋子
                    }
                }
            }
        }
    }

    getBoardState() {
        const boardState = [];
        for (let y = 0; y < this.boardSize; y++) {
            const row = [];
            for (let x = 0; x < this.boardSize; x++) {
                if (this.board[y][x] === 'black') {
                    row.push('B');
                } else if (this.board[y][x] === 'white') {
                    row.push('W');
                } else {
                    row.push('.');
                }
            }
            boardState.push(row);
        }
        return boardState;
    }

    async analyzePosition() {
        try {
            const response = await fetch('http://localhost:8001/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    board: this.getBoardState()
                })
            });
            
            const data = await response.json();
            if (data.success && data.analysis) {
                // 更新胜率和领先目数显示
                document.getElementById('win-rate').textContent = data.analysis.win_rate;
                document.getElementById('score-lead').textContent = data.analysis.score_lead;
                
                // 显示领地预测
                this.drawTerritory(data.analysis.territory);
            }
        } catch (error) {
            console.error('形势判断出错:', error);
        }
    }
    
    drawTerritory(territory) {
        const ctx = this.territoryCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.territoryCanvas.width, this.territoryCanvas.height);
        
        const cellSize = this.cellSize;
        const margin = this.margin;
        
        for (let y = 0; y < 19; y++) {
            for (let x = 0; x < 19; x++) {
                const value = territory[y][x];
                if (Math.abs(value) > 0.3) {  // 只显示较明确的领地
                    ctx.fillStyle = value > 0 ? 
                        `rgba(0, 0, 0, ${Math.abs(value) * 0.3})` : 
                        `rgba(255, 255, 255, ${Math.abs(value) * 0.3})`;
                    ctx.fillRect(
                        margin + x * cellSize - cellSize/2,
                        margin + y * cellSize - cellSize/2,
                        cellSize,
                        cellSize
                    );
                }
            }
        }
    }
}

class GoAI {
    constructor(game) {
        this.game = game;
        this.MAX_DEPTH = 3; // 搜索深度
    }

    getBestMove() {
        console.log('AI正在计算最佳落子位置...');
        
        // 获取所有可用位置
        const validMoves = this.getValidMoves();
        console.log(`找到${validMoves.length}个可用位置`);
        
        if (validMoves.length === 0) return null;

        let bestMove = null;
        let bestScore = -Infinity;

        // 对每个可能的位置进行评估
        for (const move of validMoves) {
            // 先检查是否是自杀点
            if (this.wouldBeSuicide(move)) {
                continue;
            }

            const score = this.evaluateMove(move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        console.log(`AI选择位置: (${bestMove?.x}, ${bestMove?.y}), 得分: ${bestScore}`);
        return bestMove;
    }

    // 检查是否是自杀点
    wouldBeSuicide(move) {
        // 临时落子
        this.game.board[move.y][move.x] = 'white';
        
        // 检查是否有气
        const hasLiberties = this.hasLiberties(move.x, move.y);
        
        // 恢复棋盘
        this.game.board[move.y][move.x] = null;
        
        return !hasLiberties;
    }

    // 检查是否有气
    hasLiberties(x, y, visited = new Set()) {
        const key = `${x},${y}`;
        if (visited.has(key)) return false;
        visited.add(key);

        const color = this.game.board[y][x];
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];

        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;

            if (newX >= 0 && newX < this.game.boardSize && 
                newY >= 0 && newY < this.game.boardSize) {
                // 空位就是气
                if (!this.game.board[newY][newX]) return true;
                
                // 同色棋子，递归检查
                if (this.game.board[newY][newX] === color && 
                    this.hasLiberties(newX, newY, visited)) {
                    return true;
                }
            }
        }

        return false;
    }

    evaluateMove(move) {
        let score = 0;
        
        // 1. 基础位置评分
        score += this.evaluatePosition(move);
        
        // 2. 战术评分
        score += this.evaluateTactical(move);
        
        // 3. 战略评分
        score += this.evaluateStrategic(move);
        
        return score;
    }

    evaluatePosition(move) {
        let score = 0;
        const center = Math.floor(this.game.boardSize / 2);
        
        // 天元和星位加分
        if ((move.x === 3 || move.x === 15) && (move.y === 3 || move.y === 15)) score += 10;
        if (move.x === center && move.y === center) score += 15;
        
        // 三三位置适当减分
        if ((move.x === 2 || move.x === 16) && (move.y === 2 || move.y === 16)) score -= 5;
        
        return score;
    }

    evaluateTactical(move) {
        let score = 0;
        const directions = [[1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,-1], [1,-1], [-1,1]];
        
        // 检查是否能提子
        const wouldCapture = this.checkCapture(move);
        if (wouldCapture) score += 30;
        
        // 检查是否能连接己方棋子
        let connectsToOwn = false;
        let threatensEnemy = false;
        
        for (const [dx, dy] of directions) {
            const x = move.x + dx;
            const y = move.y + dy;
            
            if (x >= 0 && x < this.game.boardSize && y >= 0 && y < this.game.boardSize) {
                if (this.game.board[y][x] === 'white') {
                    connectsToOwn = true;
                    score += 15;
                } else if (this.game.board[y][x] === 'black') {
                    threatensEnemy = true;
                    score += 10;
                }
            }
        }
        
        // 如果既连接己方又威胁对方，额外加分
        if (connectsToOwn && threatensEnemy) score += 20;
        
        return score;
    }

    evaluateStrategic(move) {
        let score = 0;
        
        // 检查是否形成眼型
        if (this.wouldFormEye(move)) score += 25;
        
        // 检查是否能分断对方棋子
        if (this.wouldCutEnemy(move)) score += 20;
        
        // 检查是否能保护自己的弱棋
        if (this.wouldProtectWeak(move)) score += 15;
        
        return score;
    }

    checkCapture(move) {
        // 临时落子
        this.game.board[move.y][move.x] = 'white';
        
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        let canCapture = false;
        
        for (const [dx, dy] of directions) {
            const x = move.x + dx;
            const y = move.y + dy;
            
            if (x >= 0 && x < this.game.boardSize && y >= 0 && y < this.game.boardSize) {
                if (this.game.board[y][x] === 'black' && !this.hasLiberties(x, y)) {
                    canCapture = true;
                    break;
                }
            }
        }
        
        // 恢复棋盘
        this.game.board[move.y][move.x] = null;
        
        return canCapture;
    }

    wouldFormEye(move) {
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        let ownStones = 0;
        
        for (const [dx, dy] of directions) {
            const x = move.x + dx;
            const y = move.y + dy;
            
            if (x >= 0 && x < this.game.boardSize && y >= 0 && y < this.game.boardSize) {
                if (this.game.board[y][x] === 'white') ownStones++;
            }
        }
        
        return ownStones >= 3;
    }

    wouldCutEnemy(move) {
        // 检查是否能切断对方的连接
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        let blackCount = 0;
        let hasSpace = false;
        
        for (const [dx, dy] of directions) {
            const x = move.x + dx;
            const y = move.y + dy;
            
            if (x >= 0 && x < this.game.boardSize && y >= 0 && y < this.game.boardSize) {
                if (this.game.board[y][x] === 'black') {
                    blackCount++;
                } else if (!this.game.board[y][x]) {
                    hasSpace = true;
                }
            }
        }
        
        return blackCount >= 2 && hasSpace;
    }

    wouldProtectWeak(move) {
        // 检查是否能保护自己的弱棋
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        
        for (const [dx, dy] of directions) {
            const x = move.x + dx;
            const y = move.y + dy;
            
            if (x >= 0 && x < this.game.boardSize && y >= 0 && y < this.game.boardSize) {
                if (this.game.board[y][x] === 'white') {
                    // 临时移除这个白子检查气数
                    const temp = this.game.board[y][x];
                    this.game.board[y][x] = null;
                    const liberties = this.countLiberties(x, y);
                    this.game.board[y][x] = temp;
                    
                    if (liberties <= 2) return true;
                }
            }
        }
        
        return false;
    }

    countLiberties(x, y) {
        let count = 0;
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        
        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;
            
            if (newX >= 0 && newX < this.game.boardSize && 
                newY >= 0 && newY < this.game.boardSize && 
                !this.game.board[newY][newX]) {
                count++;
            }
        }
        
        return count;
    }

    getValidMoves() {
        const moves = [];
        for (let y = 0; y < this.game.boardSize; y++) {
            for (let x = 0; x < this.game.boardSize; x++) {
                if (!this.game.board[y][x]) {
                    moves.push({x, y});
                }
            }
        }
        return moves;
    }
}

// 初始化游戏
window.onload = () => {
    console.log('游戏初始化...');
    new GoGame('goBoard');
}; 