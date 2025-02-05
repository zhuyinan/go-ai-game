# Go AI Game

A Go (Weiqi/Baduk) game interface that allows human players to play against KataGo AI. Features real-time position analysis and territory prediction.

## Features

- Standard 19x19 board
- Adjustable AI strength (10 kyu to 9 dan)
- Real-time position analysis
- Territory prediction
- Pass and resign options
- Clean and intuitive interface

## Requirements

- Python 3.7+
- KataGo
- FastAPI
- uvicorn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/go-ai-game.git
```

2. Install dependencies:
```bash
pip install fastapi uvicorn
```

3. Download KataGo:
   - Download appropriate version from [KataGo Releases](https://github.com/lightvector/KataGo/releases)
   - Extract to `Katago` directory

## Usage

1. Start the server:
```bash
python katago_server.py
```

2. Open index.html in your browser
3. Select AI strength and start playing

## Project Structure

.
├── README.md          # Project documentation
├── katago_server.py   # Backend server
├── index.html         # Frontend page
├── game.js           # Game logic
└── style.css         # Styling
```

## Development

- Backend: FastAPI framework
- Frontend: Vanilla JavaScript
- AI Engine: KataGo

## Notes

- Ensure KataGo is properly configured
- Default server port: 8001
- Modern browser required
- Supports standard Go rules

## Contributing

Issues and Pull Requests are welcome.

## License

MIT License
