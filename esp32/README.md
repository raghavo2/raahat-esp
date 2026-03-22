# 🚦 Raahat — ESP32 Traffic Signal Controller

Physical LED signal controller that syncs with the Raahat dashboard.

## Hardware Required

| Component | Quantity | Purpose |
|-----------|----------|---------|
| ESP32 DevKit | 1 | Main controller |
| Red LEDs | 4 | One per lane (stop) |
| Yellow LEDs | 4 | One per lane (transition) |
| Green LEDs | 4 | One per lane (go) |
| 220Ω Resistors | 12 | One per LED |
| Breadboard | 1 | Wiring |
| Jumper wires | ~30 | Connections |

## Wiring Diagram

```
ESP32 DevKit
┌─────────────────────┐
│                     │
│  GPIO13 ──[220Ω]──→ 🔴 Lane A RED
│  GPIO12 ──[220Ω]──→ 🟡 Lane A YELLOW
│  GPIO14 ──[220Ω]──→ 🟢 Lane A GREEN
│                     │
│  GPIO27 ──[220Ω]──→ 🔴 Lane B RED
│  GPIO26 ──[220Ω]──→ 🟡 Lane B YELLOW
│  GPIO25 ──[220Ω]──→ 🟢 Lane B GREEN
│                     │
│  GPIO33 ──[220Ω]──→ 🔴 Lane C RED
│  GPIO32 ──[220Ω]──→ 🟡 Lane C YELLOW
│  GPIO23 ──[220Ω]──→ 🟢 Lane C GREEN
│                     │
│  GPIO19 ──[220Ω]──→ 🔴 Lane D RED
│  GPIO18 ──[220Ω]──→ 🟡 Lane D YELLOW
│  GPIO5  ──[220Ω]──→ 🟢 Lane D GREEN
│                     │
│  GND ───────────────→ All LED cathodes (-)
│                     │
└─────────────────────┘
```

**Each LED connection:**
```
GPIO Pin → 220Ω Resistor → LED Anode (+) → LED Cathode (-) → GND
```

## Software Setup

### 1. Install Arduino IDE
Download from https://www.arduino.cc/en/software

### 2. Add ESP32 Board Support
1. Open Arduino IDE → **File** → **Preferences**
2. In "Additional Board Manager URLs", add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools** → **Board** → **Board Manager**
4. Search "ESP32" → Install **esp32 by Espressif Systems**

### 3. Install Required Libraries
Go to **Sketch** → **Include Library** → **Manage Libraries**:
- Search and install: **ArduinoJson** (by Benoit Blanchon, v7.x)

### 4. Configure the Sketch
Open `esp32_signal_controller.ino` and edit these lines:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // ← Your WiFi/hotspot name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // ← Your WiFi password
const char* SERVER_IP     = "192.168.1.100";        // ← Your laptop's LAN IP
const int   SERVER_PORT   = 3000;                   // ← Backend port
const char* INTERSECTION_ID = "INT-001";            // ← Must match registered intersection
```

### 5. Find Your Laptop's LAN IP

**Using WiFi/Hotspot:**
Both the ESP32 and your laptop must be on the **same network** (same WiFi or connected to same phone hotspot).

**On Windows:**
```
1. Open Command Prompt (cmd)
2. Type: ipconfig
3. Look for "Wireless LAN adapter Wi-Fi" → "IPv4 Address"
   Example: 192.168.137.1
```

**If using phone hotspot:**
- Connect your laptop to the hotspot
- Connect ESP32 to the same hotspot
- Use the laptop's IP from `ipconfig` as `SERVER_IP`

### 6. Flash the ESP32
1. Connect ESP32 to laptop via USB
2. In Arduino IDE: **Tools** → **Board** → **ESP32 Dev Module**
3. **Tools** → **Port** → Select the COM port (e.g., COM3)
4. Click **Upload** (→ button)
5. Open **Serial Monitor** (baud rate: 115200) to see output

## How It Works

```
┌─────────┐      WiFi       ┌──────────┐      MongoDB      ┌─────────────┐
│  ESP32  │ ◄──────────────► │ Backend  │ ◄───────────────► │   Signal    │
│  + LEDs │  polls /esp32/   │ :3000    │                   │   Engine    │
└─────────┘  signal/:id      └──────────┘                   └─────────────┘
                every 1s          ▲
                                  │ polls /traffic/current
                             ┌────┴──────┐
                             │ Dashboard │
                             │ (Browser) │
                             └───────────┘
```

1. **Signal Engine** runs in the backend, evaluating traffic every 1 second
2. **Dashboard** polls `/traffic/current` every 2 seconds — shows signal on screen
3. **ESP32** polls `/esp32/signal/:id` every 1 second — mirrors signal on LEDs
4. When the engine or a manual override changes the signal, **both** the dashboard and LEDs update within 1-2 seconds

## Testing

### Direct Testing (via ESP32 Web Server)
The ESP32 also runs a web server on port 80. Open Serial Monitor to see its IP, then:

```bash
# Set Lane A to GREEN
curl http://<ESP32_IP>/set/A/GREEN

# Emergency: Lane B green, all others red  
curl http://<ESP32_IP>/emergency/B

# Check current status
curl http://<ESP32_IP>/status
```

### Serial Monitor Commands
Type in Arduino IDE Serial Monitor (baud 115200):
```
A GREEN    → Lane A goes green
B RED      → Lane B goes red
C YELLOW   → Lane C goes yellow
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| WiFi won't connect | Check SSID/password. Yellow LEDs blink while connecting. |
| Backend unreachable | All RED LEDs blink. Check `SERVER_IP` — use `ipconfig` to find your laptop's IP. |
| LEDs don't light up | Check wiring polarity. LED long leg = anode (+) goes to resistor. |
| No signal changes | Make sure an intersection is registered in the backend and has analyzed videos. |
| COM port not found | Install CP2102 or CH340 USB driver for your ESP32 board. |
