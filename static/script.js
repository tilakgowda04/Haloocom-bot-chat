document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("sendBtn");
  const voiceBtn = document.getElementById("voiceBtn");
  const inputBox = document.getElementById("inputBox");
  const chatBox = document.getElementById("chatBox");
  const locationDisplay = document.getElementById("locationDisplay");

  let currentLat = null;
  let currentLon = null;
  let isListening = false;
  
  const synth = window.speechSynthesis;
  const recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    ? new (window.SpeechRecognition || window.webkitSpeechRecognition)()
    : null;

  function appendMsg(role, text) {
    const msg = document.createElement("div");
    msg.className = "msg " + role;
    msg.innerHTML = `<strong>${role === "user" ? "You" : "Bot"}:</strong> ${text.replace(/\n/g, "<br>")}`;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function speak(text) {
    // Cancel any ongoing speech
    synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    synth.speak(utterance);
  }

  async function getLocationNow() {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            currentLat = position.coords.latitude;
            currentLon = position.coords.longitude;
            locationDisplay.textContent = `📍 Latitude: ${currentLat.toFixed(5)}, Longitude: ${currentLon.toFixed(5)}`;
            console.log("✅ Current Location: - script.js:44", currentLat, currentLon);
            resolve();
          },
          (error) => {
            locationDisplay.textContent = "⚠️ Location access denied or unavailable.";
            console.warn("⚠️ Geolocation error: - script.js:49", error);
            reject(error);
          }
        );
      } else {
        locationDisplay.textContent = "❌ Geolocation not supported by this browser.";
        reject("Geolocation not supported");
      }
    });
  }

  async function sendMessage(message) {
    appendMsg("user", message);
    inputBox.value = "";

    const payload = { message };

    // ⬇️ Include location only for navigation queries
    const msgLower = message.toLowerCase();
    if (
      msgLower.includes("direction") ||
      msgLower.includes("navigate") ||
      msgLower.includes("route") ||
      msgLower.includes("how to go") ||
      msgLower.includes("way to") ||
      msgLower.includes("go to") ||
      msgLower.includes("how do i get to")
    ) {
      try {
        if (!currentLat || !currentLon) await getLocationNow();
        payload.lat = currentLat;
        payload.lon = currentLon;
      } catch {
        appendMsg("bot", "⚠️ Unable to access your location. Please allow GPS access.");
        return;
      }
    }

    const typingMsg = document.createElement("div");
    typingMsg.className = "msg bot";
    typingMsg.id = "typingIndicator";
    typingMsg.innerHTML = `<strong>Bot:</strong> <span class="typing-dots"><span></span><span></span><span></span></span>`;
    chatBox.appendChild(typingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const res = await fetch("/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      typingMsg.innerHTML = `<strong>Bot:</strong> ${data.response.replace(/\n/g, "<br>")}`;
      
      // 🔊 Speak all bot responses
      speak(data.response);
    } catch (err) {
      typingMsg.innerHTML = `<strong>Bot:</strong> ⚠️ Error getting response.`;
      console.error("Server error: - script.js:107", err);
    }
  }

  sendBtn.onclick = () => {
    const text = inputBox.value.trim();
    if (text) sendMessage(text);
  };

  inputBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendBtn.click();
  });

  if (recognition) {
    voiceBtn.onclick = () => {
      if (!isListening) {
        isListening = true;
        voiceBtn.style.background = "#ff4444";
        voiceBtn.textContent = "⏹️";
        voiceBtn.title = "Click to stop recording";
        recognition.start();
      } else {
        isListening = false;
        voiceBtn.style.background = "#3399ff";
        voiceBtn.textContent = "🎙️";
        voiceBtn.title = "Click to start recording";
        recognition.stop();
      }
    };

    recognition.onstart = () => {
      console.log("🎙️ Recording started... - script.js:138");
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.style.background = "#3399ff";
      voiceBtn.textContent = "🎙️";
      voiceBtn.title = "Click to start recording";
      console.log("🛑 Recording ended - script.js:146");
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      inputBox.value = text;
      isListening = false;
      voiceBtn.style.background = "#3399ff";
      voiceBtn.textContent = "🎙️";
      voiceBtn.title = "Click to start recording";
      sendMessage(text);
    };

    recognition.onerror = (event) => {
      console.error("🚫 Recognition error: - script.js:160", event.error);
      isListening = false;
      voiceBtn.style.background = "#3399ff";
      voiceBtn.textContent = "🎙️";
      voiceBtn.title = "Click to start recording";
      recognition.stop();
      appendMsg("bot", `⚠️ Error: ${event.error}`);
    };
  } else {
    voiceBtn.disabled = true;
  }

  // Add CSS for typing animation
  const style = document.createElement("style");
  style.textContent = `
    .typing-dots {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }

    .typing-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #999;
      animation: shake 1.4s infinite;
    }

    .typing-dots span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-dots span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes shake {
      0%, 100% {
        transform: translateY(0);
        opacity: 1;
      }
      50% {
        transform: translateY(-10px);
        opacity: 0.6;
      }
    }
  `;
  document.head.appendChild(style);

  // 📍 Get current location on load
  getLocationNow();

  // 🔁 Auto-update location every 30 seconds
  setInterval(getLocationNow, 30000);
});