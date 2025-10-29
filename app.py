from flask import Flask, request, jsonify, render_template
import requests
import re

app = Flask(__name__)

# Ollama LLM Configuration
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen"  # Make sure you have pulled this model: ollama pull qwen

# -----------------------------
# Helper Functions
# -----------------------------

# Reverse Geocoding using OpenStreetMap
def reverse_geocode(lat, lon):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lon}"
        response = requests.get(url, headers={"User-Agent": "HaloocomNavigator/1.0"})
        data = response.json()
        return data.get("display_name", f"lat {lat}, lon {lon}")
    except Exception as e:
        print("Reverse geocoding failed: - app.py:23", e)
        return f"lat {lat}, lon {lon}"

# Fixed directions to Haloocom
def get_fixed_directions(start_location):
    return f"""1. Sure, I'd be happy to help you find your way to Haloocom Technologies from **{start_location}**.
2. Here are the step-by-step directions from your starting point to Haloocom Technologies:
3. ➡️ Walk straight from your location to the main entrance.
4. 🚪 Enter the building.
5. ⬅️ Turn left toward the stairs.
6. ⬆️ Climb to the first floor — you'll see "Brand on Wheelz" on your right.
7. ⬆️ Continue to the 2nd floor — this is where Haloocom Technologies is located.
8. 🏁 Arrive at the destination.
9. I hope these directions are helpful for you to find your way to Haloocom Technologies."""

# Clean text output
def sanitize(text):
    return re.sub(r"\n{3,}", "\n\n", text.strip())

# -----------------------------
# Routes
# -----------------------------

@app.route("/")
def index():
    # Flask finds index.html in the 'templates' folder
    return render_template("index.html")

@app.route("/send", methods=["POST"])
def send():
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()
        lat = data.get("lat")
        lon = data.get("lon")

        if not user_message:
            return jsonify({"response": "❗ Please enter a message."})

        # Direction-related queries
        if "direction" in user_message.lower() or "to haloocom" in user_message.lower():
            start_location = reverse_geocode(lat, lon) if lat and lon else "your current location"
            fixed_reply = get_fixed_directions(start_location)
            return jsonify({
                "response": sanitize(fixed_reply),
                "is_direction": True
            })

        # Send message to Ollama model
        ollama_payload = {
            "model": OLLAMA_MODEL,
            "messages": [{"role": "user", "content": user_message}],
            "stream": False
        }

        response = requests.post(OLLAMA_URL, json=ollama_payload)
        response.raise_for_status()
        response_data = response.json()

        # Handle Ollama response properly
        if "message" in response_data and "content" in response_data["message"]:
            reply = response_data["message"]["content"]
        elif "error" in response_data:
            reply = f"⚠️ Ollama error: {response_data['error']}"
        else:
            reply = "⚠️ Ollama did not return a valid reply."

        return jsonify({
            "response": sanitize(reply),
            "is_direction": False
        })

    except requests.exceptions.ConnectionError:
        return jsonify({
            "response": "❌ Cannot connect to Ollama. Please make sure Ollama is running (run `ollama serve` in a terminal).",
            "is_direction": False
        }), 500
    except Exception as e:
        print(f"❌ Error in /send route: {e} - app.py:101")
        return jsonify({
            "response": "❌ Server error. Please check your Flask logs for more details.",
            "is_direction": False
        }), 500

# -----------------------------
# Run Server
# -----------------------------
if __name__ == "__main__":
    print("🚀 Starting Flask server with Haloocom directions and Ollama chat... - app.py:111")
    # Bind to 0.0.0.0 so the server is accessible from outside the local machine
    app.run(host='0.0.0.0', port=5000, debug=True)