"""Flask interface for the original CS50 Nim Q-learning agent."""

from __future__ import annotations

import math
import os
import pickle
import threading
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from nim import Nim, NimAI, train

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "nim_model.pkl"
TRAINING_EPISODES = 10_000

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

_model_lock = threading.RLock()
_games_lock = threading.RLock()
_games: dict[str, Nim] = {}
_ai: NimAI
_model_status: str


def _valid_model(candidate: object) -> bool:
    """Accept only a compatible, finite Q table from the existing NimAI class."""
    return (
        isinstance(candidate, NimAI)
        and isinstance(candidate.q, dict)
        and isinstance(candidate.alpha, (int, float))
        and math.isfinite(candidate.alpha)
        and isinstance(candidate.epsilon, (int, float))
        and math.isfinite(candidate.epsilon)
        and 0 <= candidate.alpha <= 1
        and 0 <= candidate.epsilon <= 1
        and all(
            isinstance(value, (int, float)) and math.isfinite(value)
            for value in candidate.q.values()
        )
    )


def _save_model(model: NimAI) -> None:
    temporary = MODEL_PATH.with_suffix(".pkl.tmp")
    with temporary.open("wb") as model_file:
        pickle.dump(model, model_file, protocol=pickle.HIGHEST_PROTOCOL)
    temporary.replace(MODEL_PATH)


def load_or_train_model() -> tuple[NimAI, str]:
    """Load a valid saved agent; train exactly once when no valid model exists."""
    if MODEL_PATH.is_file():
        try:
            with MODEL_PATH.open("rb") as model_file:
                model = pickle.load(model_file)
            if _valid_model(model):
                return model, "Loaded"
        except Exception:
            pass

    model = train(TRAINING_EPISODES)
    _save_model(model)
    return model, "Newly trained"


def _model_info() -> dict:
    return {
        "algorithm": "Q-learning",
        "training_episodes": TRAINING_EPISODES,
        "alpha": _ai.alpha,
        "epsilon": _ai.epsilon,
        "status": _model_status,
    }


def _game_payload(game_id: str, game: Nim, ai_move: tuple[int, int] | None = None) -> dict:
    human_player = 0
    winner = None
    if game.winner is not None:
        winner = "human" if game.winner == human_player else "ai"
    return {
        "game_id": game_id,
        "piles": game.piles,
        "current_player": "human" if game.player == human_player else "ai",
        "winner": winner,
        "ai_move": {"pile": ai_move[0], "count": ai_move[1]} if ai_move else None,
        "model": _model_info(),
    }


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/status")
def status():
    return jsonify({"model": _model_info()})


@app.post("/api/game")
def start_game():
    game = Nim()
    game_id = uuid.uuid4().hex
    with _games_lock:
        _games[game_id] = game
    return jsonify(_game_payload(game_id, game))


@app.post("/api/move")
def submit_move():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return _error("Send a JSON object with game_id, pile, and count.")

    game_id = data.get("game_id")
    pile_index = data.get("pile")
    count = data.get("count")
    if not isinstance(game_id, str):
        return _error("Start a game before making a move.")
    if type(pile_index) is not int or type(count) is not int:
        return _error("Choose a valid pile and number of objects.")

    with _games_lock:
        game = _games.get(game_id)
        if game is None:
            return _error("That game has expired. Start a new game.", 404)
        if game.winner is not None:
            return _error("This game is over. Start a new game to play again.", 409)
        if game.player != 0:
            return _error("It is not the human player's turn.", 409)
        if (pile_index, count) not in Nim.available_actions(game.piles):
            return _error("That move is not available in the selected pile.")

        game.move((pile_index, count))
        if game.winner is not None:
            return jsonify(_game_payload(game_id, game))

        action = _ai.choose_action(game.piles, epsilon=False)
        if action is None:
            return _error("The AI could not find a move.", 500)
        if action not in Nim.available_actions(game.piles):
            app.logger.error("AI returned an invalid move for game %s", game_id)
            return _error("The AI could not find a valid move.", 500)
        game.move(action)
        return jsonify(_game_payload(game_id, game, action))


@app.post("/api/retrain")
def retrain_model():
    global _ai, _model_status
    with _model_lock:
        _ai = train(TRAINING_EPISODES)
        _save_model(_ai)
        _model_status = "Newly trained"
    return jsonify({"model": _model_info()})


with _model_lock:
    _ai, _model_status = load_or_train_model()


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
