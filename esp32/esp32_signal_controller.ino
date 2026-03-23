/**
 * ========================================================
 *  Raahat — ESP32 Traffic Signal Controller
 * ========================================================
 * 
 * This firmware does TWO things:
 * 
 *   1. POLLS the backend every 1 second:
 *      GET http://<SERVER_IP>:<PORT>/esp32/signal/<INTERSECTION_ID>
 *      → Reads which lane is GREEN and sets LEDs accordingly.
 * 
 *   2. RUNS A WEB SERVER on port 80 for direct testing:
 *      http://<ESP32_IP>/set/A/GREEN   — manually set a lane
 *      http://<ESP32_IP>/emergency/B   — emergency override
 *      (same routes as your original test code)
 * 
 *   3. SENDS HEARTBEAT every 10 seconds:
 *      POST http://<SERVER_IP>:<PORT>/esp32/heartbeat
 *      → Backend tracks this device as online/offline.
 * 
 * Required Libraries (install via Arduino Library Manager):
 *   - ArduinoJson (by Benoit Blanchon) — v7.x
 *   - HTTPClient (built-in with ESP32 board package)
 *   - WiFi (built-in with ESP32 board package)
 *   - WebServer (built-in with ESP32 board package)
 * 
 * Board: ESP32 Dev Module (or your specific ESP32 board)
 * ========================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <uri/UriBraces.h>

// ========================================================
//  🔧 CONFIGURATION — CHANGE THESE FOR YOUR SETUP
// ========================================================

// WiFi credentials (your phone hotspot or WiFi router)
const char* WIFI_SSID     = "Excitel_mywifi_o2";
const char* WIFI_PASSWORD = "@zxcvbnm";

// Backend server (your laptop's LAN IP — NOT localhost!)
// Find it: open cmd → type "ipconfig" → look for "IPv4 Address"
const char* SERVER_IP     = "192.168.1.4";
const int   SERVER_PORT   = 3000;

// Which intersection this ESP32 controls
const char* INTERSECTION_ID = "INT-001";

// Unique ID for this device
const char* DEVICE_ID = "esp32-signal-01";

// ========================================================
//  🔌 GPIO PIN MAPPING — 3 LEDs per lane (Red, Yellow, Green)
// ========================================================
//
//  Wiring for each lane:
//    LED Anode (+)  →  GPIO pin (through 220Ω resistor)
//    LED Cathode (-)  →  GND
//
//  You can change these pins to match YOUR wiring.
//  Just make sure to use OUTPUT-capable GPIOs.
//  Avoid: GPIO 0, 1, 3, 6-11 (used for flash/serial)
//

struct Lane {
    int redPin;
    int yellowPin;
    int greenPin;
    char id;
    String currentState;  // "RED", "YELLOW", "GREEN"
};

// 4 lanes × 3 LEDs = 12 GPIO pins total
Lane lanes[4] = {
    {13, 12, 14, 'A', "RED"},  // Lane A: Red=GPIO13, Yellow=GPIO12, Green=GPIO14
    {27, 26, 25, 'B', "RED"},  // Lane B: Red=GPIO27, Yellow=GPIO26, Green=GPIO25
    {33, 32, 23, 'C', "RED"},  // Lane C: Red=GPIO33, Yellow=GPIO32, Green=GPIO23
    {19, 18,  5, 'D', "RED"},  // Lane D: Red=GPIO19, Yellow=GPIO18, Green=GPIO5
};

const int NUM_LANES = 4;

// ========================================================
//  ⏱️ TIMING
// ========================================================

unsigned long lastPollTime = 0;
unsigned long lastHeartbeatTime = 0;
const unsigned long POLL_INTERVAL = 1000;       // Poll backend every 1 second
const unsigned long HEARTBEAT_INTERVAL = 10000;  // Heartbeat every 10 seconds

bool backendReachable = false;
int failCount = 0;
const int MAX_FAILS_BEFORE_ERROR = 5;  // After 5 failed polls, show error state

// ========================================================
//  🌐 WEB SERVER (for direct testing — same as your test code)
// ========================================================

WebServer webServer(80);

// ========================================================
//  💡 LED CONTROL FUNCTIONS
// ========================================================

/**
 * Set a single lane to a specific color state.
 * Handles the actual GPIO writes.
 */
void setLane(int idx, String state) {
    if (idx < 0 || idx >= NUM_LANES) return;

    // Turn all LEDs off first (safety)
    digitalWrite(lanes[idx].redPin, LOW);
    digitalWrite(lanes[idx].yellowPin, LOW);
    digitalWrite(lanes[idx].greenPin, LOW);

    if (state == "GREEN") {
        digitalWrite(lanes[idx].greenPin, HIGH);
    } else if (state == "YELLOW") {
        digitalWrite(lanes[idx].yellowPin, HIGH);
    } else {
        // Default to RED for safety
        digitalWrite(lanes[idx].redPin, HIGH);
    }

    lanes[idx].currentState = state;
    Serial.printf("💡 Lane %c → %s\n", lanes[idx].id, state.c_str());
}

/**
 * Set ALL lanes to RED — used on boot and error states.
 */
void allRed() {
    for (int i = 0; i < NUM_LANES; i++) {
        setLane(i, "RED");
    }
}

/**
 * Error blink — all RED LEDs blink to indicate backend is unreachable.
 * Non-blocking: uses millis() timing.
 */
bool errorBlinkState = false;
unsigned long lastBlinkTime = 0;

void errorBlink() {
    if (millis() - lastBlinkTime > 500) {
        lastBlinkTime = millis();
        errorBlinkState = !errorBlinkState;

        for (int i = 0; i < NUM_LANES; i++) {
            digitalWrite(lanes[i].redPin, errorBlinkState ? HIGH : LOW);
            digitalWrite(lanes[i].yellowPin, LOW);
            digitalWrite(lanes[i].greenPin, LOW);
        }
    }
}

/**
 * Yellow transition: briefly flash yellow before switching to green.
 * This makes the signal change look realistic.
 */
void yellowTransition(int newGreenIdx) {
    // Set the NEW green lane to yellow briefly
    setLane(newGreenIdx, "YELLOW");

    // Set all others to RED
    for (int i = 0; i < NUM_LANES; i++) {
        if (i != newGreenIdx) {
            setLane(i, "RED");
        }
    }

    delay(800);  // Yellow for 800ms

    // Now switch to green
    setLane(newGreenIdx, "GREEN");
}

// ========================================================
//  📡 BACKEND COMMUNICATION
// ========================================================

/**
 * Poll the backend for current signal state.
 * GET /esp32/signal/<INTERSECTION_ID>
 * 
 * Expected response:
 * {
 *   "active_lane": "B",
 *   "mode": "AUTO",
 *   "remaining": 23,
 *   "lanes": { "A": "RED", "B": "GREEN", "C": "RED", "D": "RED" }
 * }
 */
void pollSignalState() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️  WiFi not connected, skipping poll");
        backendReachable = false;
        return;
    }

    HTTPClient http;
    String url = String("http://") + SERVER_IP + ":" + SERVER_PORT 
                 + "/esp32/signal/" + INTERSECTION_ID;

    http.begin(url);
    http.setTimeout(3000);  // 3 second timeout

    int httpCode = http.GET();

    if (httpCode == 200) {
        String payload = http.getString();
        backendReachable = true;
        failCount = 0;

        // Parse JSON
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (error) {
            Serial.printf("❌ JSON parse error: %s\n", error.c_str());
            http.end();
            return;
        }

        String activeLane = doc["active_lane"] | "";
        String mode = doc["mode"] | "AUTO";
        int remaining = doc["remaining"] | 0;

        Serial.printf("📡 Signal: Lane %s GREEN (%s, %ds left)\n", 
                       activeLane.c_str(), mode.c_str(), remaining);

        // Update each lane's LED based on the response
        JsonObject lanesObj = doc["lanes"];
        
        // Check if active lane changed — if so, do yellow transition
        String previousActive = "";
        for (int i = 0; i < NUM_LANES; i++) {
            if (lanes[i].currentState == "GREEN") {
                previousActive = String(lanes[i].id);
                break;
            }
        }

        bool laneChanged = (activeLane != "" && activeLane != previousActive && previousActive != "");

        if (laneChanged) {
            // Find the new green lane index
            int newGreenIdx = -1;
            for (int i = 0; i < NUM_LANES; i++) {
                if (String(lanes[i].id) == activeLane) {
                    newGreenIdx = i;
                    break;
                }
            }
            if (newGreenIdx >= 0) {
                Serial.printf("🔄 Lane change: %s → %s (yellow transition)\n", 
                             previousActive.c_str(), activeLane.c_str());
                yellowTransition(newGreenIdx);
            }
        } else {
            // No lane change — just ensure LEDs match the state
            for (int i = 0; i < NUM_LANES; i++) {
                String laneKey = String(lanes[i].id);
                String color = lanesObj[laneKey] | "RED";

                // Only update if state actually changed (avoid flickering)
                if (lanes[i].currentState != color) {
                    setLane(i, color);
                }
            }
        }

    } else {
        failCount++;
        Serial.printf("❌ Backend poll failed (HTTP %d), fail count: %d\n", httpCode, failCount);

        if (failCount >= MAX_FAILS_BEFORE_ERROR) {
            backendReachable = false;
        }
    }

    http.end();
}

/**
 * Send heartbeat to backend.
 * POST /esp32/heartbeat
 * Body: { "device_id": "...", "intersection_id": "...", "ip": "..." }
 */
void sendHeartbeat() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/esp32/heartbeat";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(3000);

    // Build JSON
    JsonDocument doc;
    doc["device_id"] = DEVICE_ID;
    doc["intersection_id"] = INTERSECTION_ID;
    doc["ip"] = WiFi.localIP().toString();

    String body;
    serializeJson(doc, body);

    int httpCode = http.POST(body);

    if (httpCode == 200) {
        Serial.println("💓 Heartbeat sent OK");
    } else {
        Serial.printf("⚠️  Heartbeat failed (HTTP %d)\n", httpCode);
    }

    http.end();
}

// ========================================================
//  🌐 WEB SERVER ROUTES (for direct testing)
// ========================================================

void setupWebServer() {
    // Route: http://<ESP32_IP>/set/A/GREEN
    webServer.on(UriBraces("/set/{}/{}"), []() {
        String laneLetter = webServer.pathArg(0);
        String state = webServer.pathArg(1);
        laneLetter.toUpperCase();
        state.toUpperCase();

        int laneIdx = laneLetter[0] - 'A';
        if (laneIdx >= 0 && laneIdx < NUM_LANES) {
            setLane(laneIdx, state);
            webServer.send(200, "text/plain", "OK: Lane " + laneLetter + " → " + state);
        } else {
            webServer.send(400, "text/plain", "Invalid lane: " + laneLetter);
        }
    });

    // Route: http://<ESP32_IP>/emergency/B (green corridor)
    webServer.on(UriBraces("/emergency/{}"), []() {
        String laneLetter = webServer.pathArg(0);
        laneLetter.toUpperCase();
        int targetIdx = laneLetter[0] - 'A';

        if (targetIdx >= 0 && targetIdx < NUM_LANES) {
            for (int i = 0; i < NUM_LANES; i++) {
                setLane(i, (i == targetIdx) ? "GREEN" : "RED");
            }
            webServer.send(200, "text/plain", "🚨 EMERGENCY: Lane " + laneLetter + " GREEN, all others RED");
        } else {
            webServer.send(400, "text/plain", "Invalid lane");
        }
    });

    // Route: http://<ESP32_IP>/status — show current state
    webServer.on("/status", []() {
        JsonDocument doc;
        doc["device_id"] = DEVICE_ID;
        doc["intersection_id"] = INTERSECTION_ID;
        doc["backend_reachable"] = backendReachable;
        doc["wifi_rssi"] = WiFi.RSSI();
        doc["ip"] = WiFi.localIP().toString();

        JsonObject lanesObj = doc["lanes"].to<JsonObject>();
        for (int i = 0; i < NUM_LANES; i++) {
            lanesObj[String(lanes[i].id)] = lanes[i].currentState;
        }

        String response;
        serializeJsonPretty(doc, response);
        webServer.send(200, "application/json", response);
    });

    webServer.begin();
    Serial.println("🌐 Web server started on port 80");
}

// ========================================================
//  📶 WIFI CONNECTION
// ========================================================

void connectWiFi() {
    Serial.printf("📶 Connecting to WiFi: %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
        delay(500);
        Serial.print(".");
        attempts++;

        // Blink all yellow LEDs while connecting
        for (int i = 0; i < NUM_LANES; i++) {
            digitalWrite(lanes[i].yellowPin, (attempts % 2 == 0) ? HIGH : LOW);
        }
    }

    // Turn off yellow LEDs
    for (int i = 0; i < NUM_LANES; i++) {
        digitalWrite(lanes[i].yellowPin, LOW);
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi CONNECTED!");
        Serial.print("📍 ESP32 IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("📡 Signal Strength: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println("\n❌ WiFi connection FAILED!");
        Serial.println("Check SSID and password, then restart.");
    }
}

// ========================================================
//  🚀 SETUP
// ========================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n========================================");
    Serial.println("  🚦 Raahat Traffic Signal Controller");
    Serial.println("========================================");
    Serial.printf("  Device:       %s\n", DEVICE_ID);
    Serial.printf("  Intersection: %s\n", INTERSECTION_ID);
    Serial.printf("  Server:       %s:%d\n", SERVER_IP, SERVER_PORT);
    Serial.println("========================================\n");

    // Initialize all LED pins as OUTPUT
    for (int i = 0; i < NUM_LANES; i++) {
        pinMode(lanes[i].redPin, OUTPUT);
        pinMode(lanes[i].yellowPin, OUTPUT);
        pinMode(lanes[i].greenPin, OUTPUT);
    }

    // Start with all RED (safe state)
    allRed();
    Serial.println("🔴 All lanes set to RED (boot state)");

    // Connect to WiFi
    connectWiFi();

    // Start web server for direct testing
    if (WiFi.status() == WL_CONNECTED) {
        setupWebServer();
    }

    Serial.println("\n🚀 System ready! Polling backend...\n");
}

// ========================================================
//  🔁 MAIN LOOP
// ========================================================

void loop() {
    unsigned long now = millis();

    // Handle WiFi reconnection
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("📶 WiFi lost, reconnecting...");
        connectWiFi();
        if (WiFi.status() == WL_CONNECTED) {
            setupWebServer();
        }
        return;
    }

    // Handle web server requests (for direct testing)
    webServer.handleClient();

    // Poll backend for signal state every POLL_INTERVAL
    if (now - lastPollTime >= POLL_INTERVAL) {
        lastPollTime = now;
        pollSignalState();
    }

    // Send heartbeat every HEARTBEAT_INTERVAL
    if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
        lastHeartbeatTime = now;
        sendHeartbeat();
    }

    // If backend is unreachable, show error blink
    if (!backendReachable && failCount >= MAX_FAILS_BEFORE_ERROR) {
        errorBlink();
    }

    // Serial monitor manual control (for debugging)
    // Type "A GREEN" or "B RED" in Serial Monitor
    if (Serial.available() > 0) {
        String input = Serial.readStringUntil('\n');
        input.trim();
        input.toUpperCase();

        if (input.length() >= 3) {
            int laneIdx = input[0] - 'A';
            String state = input.substring(2);
            if (laneIdx >= 0 && laneIdx < NUM_LANES) {
                setLane(laneIdx, state);
            }
        }
    }
}
