const board = document.querySelector("#board");
const statusBanner = document.querySelector("#status-banner");
const statusMessage = document.querySelector("#status-message");
const takeButton = document.querySelector("#take-button");
const restartButton = document.querySelector("#restart-button");
const retrainButton = document.querySelector("#retrain-button");
const selectionSummary = document.querySelector("#selection-summary");
const objectsRemaining = document.querySelector("#objects-remaining");
const humanCard = document.querySelector("#human-player");
const aiCard = document.querySelector("#ai-player");
const humanState = document.querySelector("#human-state");
const aiState = document.querySelector("#ai-state");
const modelStatus = document.querySelector("#model-status");
const modelIndicator = document.querySelector(".model-indicator");

let game = null;
let selected = null;
let busy = false;

function setStatus(message, kind = "") {
  statusMessage.textContent = message;
  statusBanner.dataset.kind = kind;
}

function setModel(model) {
  if (!model) return;
  modelStatus.textContent = model.status;
  if (Number.isFinite(model.alpha)) document.querySelector("#alpha-value").textContent = model.alpha.toFixed(2);
  if (Number.isFinite(model.epsilon)) document.querySelector("#epsilon-value").textContent = model.epsilon.toFixed(2);
  modelIndicator.classList.toggle("training", model.status === "Training…");
}

function setTurn(current) {
  const humanTurn = current === "human" && !game?.winner;
  humanCard.classList.toggle("active-player", humanTurn);
  aiCard.classList.toggle("active-player", current === "ai" && !game?.winner);
  if (game?.winner) {
    humanState.textContent = game.winner === "human" ? "Winner" : "Game over";
    aiState.textContent = game.winner === "ai" ? "Winner" : "Game over";
  } else {
    humanState.textContent = humanTurn ? "Your turn" : "Waiting";
    aiState.textContent = current === "ai" ? "Thinking…" : "Ready to play";
  }
}

function render() {
  if (!game) return;
  board.replaceChildren();
  game.piles.forEach((count, pileIndex) => {
    const row = document.createElement("div");
    row.className = `pile-row${selected?.pile === pileIndex ? " selected" : ""}`;
    const label = document.createElement("span");
    label.className = "pile-label";
    label.textContent = `PILE 0${pileIndex + 1}`;
    const objects = document.createElement("div");
    objects.className = "objects";
    objects.setAttribute("role", "group");
    objects.setAttribute("aria-label", `Pile ${pileIndex + 1}, ${count} objects`);
    if (!count) {
      const empty = document.createElement("span");
      empty.className = "empty-pile";
      empty.textContent = "Empty";
      objects.append(empty);
    }
    for (let objectIndex = 0; objectIndex < count; objectIndex += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `object${selected?.pile === pileIndex && objectIndex < selected.count ? " chosen" : ""}`;
      button.setAttribute("aria-label", `Take ${objectIndex + 1} from pile ${pileIndex + 1}`);
      button.setAttribute("aria-pressed", String(selected?.pile === pileIndex && objectIndex < selected.count));
      button.disabled = busy || game.winner !== null;
      button.addEventListener("click", () => {
        selected = { pile: pileIndex, count: objectIndex + 1 };
        render();
      });
      objects.append(button);
    }
    const pileCount = document.createElement("span");
    pileCount.className = "pile-count";
    pileCount.textContent = String(count).padStart(2, "0");
    row.append(label, objects, pileCount);
    board.append(row);
  });
  const total = game.piles.reduce((sum, count) => sum + count, 0);
  objectsRemaining.textContent = `${total} OBJECT${total === 1 ? "" : "S"} REMAIN`;
  selectionSummary.textContent = selected
    ? `Pile ${selected.pile + 1} · ${selected.count} object${selected.count === 1 ? "" : "s"}`
    : "Select objects from a pile";
  takeButton.disabled = busy || Boolean(game.winner) || !selected;
  takeButton.firstChild.textContent = game.winner ? "Game over " : busy ? "AI is thinking " : "Take objects ";
  setTurn(game.current_player);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Something went wrong.");
  return payload;
}

async function startGame() {
  busy = true;
  selected = null;
  takeButton.disabled = true;
  setStatus("Setting up the board…");
  try {
    game = await requestJson("/api/game", { method: "POST", body: "{}" });
    setModel(game.model);
    setStatus("Choose a pile, then select how many objects to take.");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    busy = false;
    render();
  }
}

async function takeObjects() {
  if (!selected || !game || busy) return;
  const move = { game_id: game.game_id, ...selected };
  busy = true;
  selected = null;
  setStatus("Your move is in. The AI is considering its response…");
  render();
  try {
    game = await requestJson("/api/move", { method: "POST", body: JSON.stringify(move) });
    if (game.winner) {
      const humanWon = game.winner === "human";
      setStatus(humanWon ? "You win. The AI took the last object." : "The AI wins. Your move left it one object to take.", "winner");
    } else if (game.ai_move) {
      setStatus(`The AI took ${game.ai_move.count} from pile ${game.ai_move.pile + 1}. Your turn.`, "");
    } else {
      setStatus("Your turn. Choose a pile and an object.");
    }
    setModel(game.model);
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    busy = false;
    render();
  }
}

async function retrain() {
  retrainButton.disabled = true;
  const oldLabel = retrainButton.childNodes[1];
  if (oldLabel) oldLabel.textContent = " Training 10,000 games…";
  setModel({ status: "Training…" });
  setStatus("Training the Q-learning model. This can take a few seconds.");
  try {
    const result = await requestJson("/api/retrain", { method: "POST", body: "{}" });
    setModel(result.model);
    setStatus("Model retrained and saved. Start a new game to play against it.");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    retrainButton.disabled = false;
    if (oldLabel) oldLabel.textContent = " Retrain the model";
  }
}

restartButton.addEventListener("click", startGame);
takeButton.addEventListener("click", takeObjects);
retrainButton.addEventListener("click", retrain);

requestJson("/api/status")
  .then((result) => setModel(result.model))
  .catch(() => { modelStatus.textContent = "Unavailable"; });
startGame();
