# Nim — Human vs AI

A polished browser version of Harvard's CS50 AI Nim problem set. Play the classic pile-removal game against the original Python Q-learning agent, served through a lightweight Flask API.

## How the AI learns

The agent stores a Q-value for each `(state, action)` pair. After each turn, it adjusts that value toward the observed reward plus the best expected value from the next state:

```text
Q(s, a) ← Q(s, a) + α [reward + future reward − Q(s, a)]
```

During training, it uses an epsilon-greedy policy to balance exploration and exploitation. The existing implementation uses a learning rate (`alpha`) of `0.5` and an exploration rate (`epsilon`) of `0.1`. At the end of a game, the winning player's last move receives `+1` and the losing player's last move receives `−1`; intermediate moves receive `0`.

Nim follows the CS50 problem set's misère convention: **the player who takes the last object loses**. A game starts with piles of 1, 3, 5, and 7 objects.

## Features

- Human vs AI play with object-based pile selection.
- Backend move validation, turn handling, and winner detection using the existing `Nim` class.
- The existing `NimAI` Q-learning agent chooses every AI move in Python.
- A `nim_model.pkl` model is trained for 10,000 games on first launch and reused on later launches.
- Use **Retrain the model** to explicitly train and save a replacement model.
- Responsive dark interface with live turn, game, and model status.

## Technologies

- Python 3.10+
- Flask
- HTML, CSS, and vanilla JavaScript
- Python `pickle` for local model persistence

## Installation

Clone the repository and enter its directory:

```bash
git clone https://github.com/jeevan-24052008/CS50-AI-Nim.git
cd CS50-AI-Nim
```

Create and activate a virtual environment (recommended), then install the dependency:

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Run the web application

```bash
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). On the first launch, the app trains for 10,000 games and saves `nim_model.pkl`; this initial startup takes longer. Later launches load the saved model. If the model is missing or unreadable, the app trains a replacement.

For local development only, enable Flask's debug server with `FLASK_DEBUG=1` before starting the app. Do not enable debug mode on a public deployment.

The original terminal interface remains available:

```bash
python play.py
```

## Screenshots

Add screenshots of the running application here:

![Nim game screenshot — desktop](docs/screenshots/nim-desktop.png)

![Nim game screenshot — mobile](docs/screenshots/nim-mobile.png)

## Project structure

```text
CS50-AI-Nim/
├── app.py
├── nim.py
├── play.py
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── script.js
    └── style.css
```

The generated `nim_model.pkl`, Python bytecode, and virtual environments are excluded by `.gitignore`.
