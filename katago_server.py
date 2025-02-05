from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import threading
from pydantic import BaseModel
from typing import List, Optional
import logging
import os
import time
import sys

app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# KataGo路径配置
KATAGO_DIR = r"C:\Users\Admin\Documents\个人\Program\Test\Katago\katago-v1.15.3-opencl-windows-x64"
KATAGO_EXE = os.path.join(KATAGO_DIR, "katago.exe")
CONFIG_FILE = os.path.join(KATAGO_DIR, "default_gtp.cfg")
MODEL_FILE = os.path.join(KATAGO_DIR, "kata1-b28c512nbt-s8268121856-d4612191185.bin.gz")

# 添加等级和playouts的映射关系
RANK_PLAYOUTS = {
    # 业余级别 (10级-1级)
    '10k': 100,    # 10级
    '9k': 200,
    '8k': 300,
    '7k': 400,
    '6k': 500,
    '5k': 700,
    '4k': 900,
    '3k': 1200,
    '2k': 1500,
    '1k': 2000,   # 1级
    
    # 业余段位 (1段-9段)
    '1d': 3000,    # 1段
    '2d': 4000,
    '3d': 5000,
    '4d': 6000,
    '5d': 8000,
    '6d': 10000,
    '7d': 12000,
    '8d': 15000,
    '9d': 20000    # 9段
}

class Board(BaseModel):
    board: List[List[str]]
    rank: str = '1k'  # 默认1级

class KataGoProcess:
    def __init__(self, playouts=1000):
        logger.info(f"启动KataGo，路径: {KATAGO_EXE}")
        
        # 验证文件存在
        if not os.path.exists(KATAGO_EXE):
            raise FileNotFoundError(f"找不到KataGo执行文件: {KATAGO_EXE}")
        if not os.path.exists(CONFIG_FILE):
            raise FileNotFoundError(f"找不到配置文件: {CONFIG_FILE}")
        if not os.path.exists(MODEL_FILE):
            raise FileNotFoundError(f"找不到模型文件: {MODEL_FILE}")
        
        # 启动进程
        try:
            self.process = subprocess.Popen(
                [KATAGO_EXE, "gtp", "-config", CONFIG_FILE, "-model", MODEL_FILE],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=KATAGO_DIR,
                text=True,
                bufsize=1
            )
            
            # 等待KataGo启动
            time.sleep(2)
            
            # 检查进程是否正常运行
            if self.process.poll() is not None:
                raise Exception("KataGo进程未能正常启动")
            
            # 测试通信
            version = self.send_command("version")
            logger.info(f"KataGo版本: {version}")
            
        except Exception as e:
            logger.error(f"启动KataGo时出错: {str(e)}")
            if hasattr(self, 'process'):
                stderr_output = self.process.stderr.read()
                logger.error(f"KataGo错误输出: {stderr_output}")
            raise

    def send_command(self, command: str) -> str:
        try:
            logger.info(f"发送命令: {command}")
            # 发送命令
            self.process.stdin.write(command + "\n")
            self.process.stdin.flush()
            
            # 读取响应
            response = []
            while True:
                line = self.process.stdout.readline().strip()
                logger.info(f"读取行: {line}")
                if line.startswith('='):
                    response.append(line[2:])  # 去掉"= "前缀
                    break
                elif line.startswith('?'):
                    raise Exception(f"KataGo错误: {line}")
            
            # 读取空行
            self.process.stdout.readline()
            
            result = ' '.join(response).strip()
            logger.info(f"完整响应: {result}")
            return result
            
        except Exception as e:
            logger.error(f"命令执行错误: {str(e)}")
            raise

    def get_score_analysis(self) -> dict:
        """获取当前局面的形势判断"""
        try:
            # 初始化变量
            black_win_rate = 0.5  # 默认值
            score_lead = 0
            territory = [[0 for _ in range(19)] for _ in range(19)]
            
            # 使用 kata-raw-nn all 命令
            response = self.send_command("kata-raw-nn all")
            logger.info(f"形势判断原始响应: {response}")
            
            # 解析响应
            lines = response.strip().split('\n')
            for line in lines:
                if line.startswith('whiteWin'):
                    parts = line.split()
                    if len(parts) >= 2:
                        white_win_rate = float(parts[1])
                        black_win_rate = 1 - white_win_rate
                elif line.startswith('scoreLead'):
                    parts = line.split()
                    if len(parts) >= 2:
                        score_lead = float(parts[1])
                elif line.startswith('ownership'):
                    parts = line.split()
                    if len(parts) > 1:
                        ownership = [float(x) for x in parts[1:]]
                        for i in range(361):  # 19x19
                            row = i // 19
                            col = i % 19
                            territory[row][col] = ownership[i]

            return {
                "win_rate": round(black_win_rate * 100, 1),  # 转换为黑棋胜率百分比
                "score_lead": round(-score_lead, 1),  # 转换为黑棋视角的领先目数
                "territory": territory
            }
        except Exception as e:
            logger.error(f"获取形势判断时出错: {str(e)}")
            logger.error(f"完整响应: {response if 'response' in locals() else 'No response'}")
            return None

    def _get_territory(self) -> dict:
        """获取领地预测"""
        try:
            response = self.send_command("kata-raw-nn all")
            territory = [[0 for _ in range(19)] for _ in range(19)]
            
            lines = response.strip().split('\n')
            for line in lines:
                if line.startswith('ownership'):
                    parts = line.split()
                    if len(parts) > 1:
                        ownership = [float(x) for x in parts[1:]]
                        for i in range(361):  # 19x19
                            row = i // 19
                            col = i % 19
                            territory[row][col] = ownership[i]
                        break
            
            return territory
        except Exception as e:
            logger.error(f"获取领地预测时出错: {str(e)}")
            return None

@app.post("/api/move")
async def get_move(board_data: Board):
    try:
        # 获取对应等级的playouts值
        playouts = RANK_PLAYOUTS.get(board_data.rank, 2000)  # 默认2000
        katago = KataGoProcess(playouts=playouts)
        
        logger.info("收到新的落子请求")
        logger.info(f"当前棋盘状态: {board_data.board}")
        
        # 设置所有已有的棋子
        for y in range(len(board_data.board)):
            for x in range(len(board_data.board[y])):
                if board_data.board[y][x] in ['B', 'W']:
                    color = 'black' if board_data.board[y][x] == 'B' else 'white'
                    col = chr(x + ord('A') + (1 if x >= 8 else 0))  # 跳过'I'
                    move = f"{col}{y + 1}"
                    logger.info(f"设置棋子: {color} {move}")
                    katago.send_command(f"play {color} {move}")
        
        # 让KataGo生成下一步棋
        logger.info("请求KataGo生成下一步棋")
        response = katago.send_command("genmove white")
        logger.info(f"KataGo响应: {response}")
        
        # 解析KataGo的响应
        move = parse_katago_response(response)
        logger.info(f"解析后的移动: {move}")
        
        # 关闭进程
        katago.process.terminate()
        
        return {"success": True, "move": move}
    except Exception as e:
        logger.error(f"错误: {str(e)}")
        if 'katago' in locals():
            try:
                katago.process.terminate()
            except:
                pass
        return {"success": False, "error": str(e)}

def parse_katago_response(response: str) -> dict:
    try:
        move_str = response.strip()
        if move_str.lower() == 'pass':
            return None
        
        # 处理坐标，例如 "D4"
        col = ord(move_str[0].upper()) - ord('A')
        if col >= 8:  # 跳过'I'
            col -= 1
        row = int(move_str[1:]) - 1
        
        logger.info(f"解析移动: {move_str} -> x={col}, y={row}")
        return {"x": col, "y": row}
    except Exception as e:
        logger.error(f"解析响应错误: {str(e)}")
        return None

@app.post("/api/analyze")
async def analyze_position(board_data: Board):
    """分析当前局面"""
    try:
        katago = KataGoProcess()
        
        # 重现当前局面
        for y in range(len(board_data.board)):
            for x in range(len(board_data.board[y])):
                if board_data.board[y][x] in ['B', 'W']:
                    color = 'black' if board_data.board[y][x] == 'B' else 'white'
                    col = chr(x + ord('A') + (1 if x >= 8 else 0))
                    move = f"{col}{y + 1}"
                    katago.send_command(f"play {color} {move}")
        
        # 获取分析结果
        analysis = katago.get_score_analysis()
        katago.process.terminate()
        
        return {"success": True, "analysis": analysis}
    except Exception as e:
        logger.error(f"分析局面时出错: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001) 