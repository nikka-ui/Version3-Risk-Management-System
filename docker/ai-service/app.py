"""RMS AI service placeholder - replace with Flask ML/NLP implementation."""
import os
from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "ai-service",
        "mode": "placeholder",
    })


@app.route("/classify", methods=["POST"])
def classify():
    return jsonify({
        "status": "not_implemented",
        "message": "AI classification will be implemented per V2 spec.",
    }), 501


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
