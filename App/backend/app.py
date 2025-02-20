from flask import Flask, request, jsonify, send_from_directory
import json
import os
from flask_cors import CORS
import numpy as np
from music21 import stream, chord
import tensorflow as tf
from tensorflow.keras.models import load_model
from sklearn.preprocessing import LabelEncoder

app = Flask(__name__, static_folder="../frontend/build", static_url_path_="")
CORS(app)

model = load_model("checkpoint-49.h5")

encoder = LabelEncoder()
encoder.classes_ = np.load("encoder_classes2.npy", allow_pickle=True)

# Load notes values corresponding to each chord
with open("chords_set.json", "r") as f:
    chords_notes = [list(c.values())[0] for c in json.load(f)]

sequence_length = 4


def sample_with_temperature_and_multiplier(predictions, temperature, history, repetitiveness):
    """
    Applies temperature sampling and multiplier
    
    - `predictions`: Raw logits from model output.
    - `temperature`: Controls randomness (higher = more diverse).
    - `history`: List of recent chords.
    - `repetitiveness`: Multiplier applied to probabilities of recent chords (0.0-1.0).
    """
    predictions = np.asarray(predictions).astype("float64")

    # Apply temperature scaling
    predictions = np.log(predictions + 1e-8) / temperature  
    exp_preds = np.exp(predictions)
    probabilities = (exp_preds / np.sum(exp_preds))[0]

    # Apply multiplier to recently played chords
    for recent_chord in history:
        rc = int(recent_chord.item())
        probabilities[rc] *= repetitiveness

    # Renormalize probabilities to sum to 1
    probabilities /= np.sum(probabilities)

    return np.random.choice(len(probabilities), p=probabilities)

def generate_chord_sequence(seed_sequence, num_chords=4, temperature=1.0, window_size=4, repetitiveness=2.0):
    """
    Generate a chord sequence using temperature sampling for repetition.
    
    - `seed_sequence`: Initial chord sequence (numerical encoding).
    - `num_chords`: Number of chords to generate.
    - `temperature`: Randomness factor.
    - `window_size`: How many past chords to consider for repetitiveness.
    - `repetitiveness`: Weight to increase probability of recently played chords.
    """
    generated_chords = seed_sequence[:]
    for _ in range(num_chords - len(seed_sequence)):
        if len(seed_sequence) == 0:
            random_seed = np.random.choice(len(encoder.classes_)-1)
            input_seq = np.array(random_seed).reshape(1,-1)            # Start with a random chord
        elif sequence_length <= len(seed_sequence):
            input_seq = np.array(generated_chords[-sequence_length:]).reshape(1, -1)  # Get the last n for the starting sequence
        else:
            input_seq = np.array(generated_chords[:]).reshape(1, -1)   # Use the whole seed sequence

        prediction = model.predict(input_seq, verbose=0)

        history = generated_chords[-window_size:] if window_size > 0 else []

        next_chord = sample_with_temperature_and_multiplier(prediction, temperature, history, repetitiveness)
        generated_chords = np.append(generated_chords, next_chord)
    
    return generated_chords.astype(int)

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    num_chords = data.get("length", 4)
    temperature = data.get("temperature", 1.0)
    seed = data.get("selected_chords", [])
    seed = [chord['value'] for chord in seed]
    seed = encoder.transform(seed)
    repetitiveness = data.get("repetitiveness", 2.0)
    if repetitiveness == 0.0:
        repetitiveness *= 0.01
    elif repetitiveness == 1.0:
        repetitiveness *= 5
    elif repetitiveness == 2.0:
        repetitiveness *= 20
    elif repetitiveness == 3.0:
        repetitiveness *= 100
    elif repetitiveness == 4.0:
        repetitiveness *= 10_000
    generated_chords = generate_chord_sequence(seed, num_chords, temperature, repetitiveness=repetitiveness)

    chords = encoder.inverse_transform(generated_chords)

    notes = [chords_notes[c] for c in generated_chords]
    notes = [chord.Chord(c) for c in notes]
    
    s = stream.Stream()
    for c in notes:
        c.quarterLength = 4  # Set duration (4 beats)
        s.append(c)

    # Save as MIDI file
    midi_file_name = os.path.join(app.root_path, "static", "chord_progression.mid")
    os.makedirs(os.path.dirname(midi_file_name), exist_ok=True)

    # Save as MIDI file
    s.write("midi", fp=midi_file_name)

    if os.path.exists(midi_file_name):
        print("File created")
    else:
        print("File creation failed.")

    return jsonify({
        "chord_progression": chords.tolist(),
        "midi_url": "/static/chord_progression.mid"
    })

@app.route("/chords", methods=["OPTIONS", "GET"])
def chords():
    return jsonify({"all_chords" : encoder.classes_.tolist()})

@app.route("/")
def index():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'index.html')

# Catch-all route to serve React files (for React Router)
@app.route("/<path:path>")
def serve_static_files(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    if os.getenv("FLASK_ENV") != "production":
        app.run(debug=True, port=5000)