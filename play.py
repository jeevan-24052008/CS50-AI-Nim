"""Run the original terminal game with the persistent Q-learning model."""

from app import _ai
from nim import play


if __name__ == "__main__":
    play(_ai)
