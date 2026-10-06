# Preliminary IoT implementation

This starter firmware reads temperature and relative humidity from a DHT22 connected to an ESP32, then submits JSON to the project's existing `POST /api/sensor-data` endpoint. The backend stores the reading in Firebase and assigns its `recorded_at` timestamp.

## Hardware and wiring

| DHT22 | ESP32 |
|---|---|
| VCC | 3V3 (or the sensor module's supported supply) |
| GND | GND |
| DATA | GPIO 4 by default (`DHT_PIN` in `config.h`) |

For a bare DHT22, add a 4.7–10 kΩ pull-up resistor between DATA and VCC. A breakout module may already include one. Confirm the pinout and voltage ratings of the specific module before connecting it.

## Build and configure

1. Install ESP32 board support in Arduino IDE and select the matching ESP32 board and serial port.
2. Install **DHT sensor library by Adafruit**, **Adafruit Unified Sensor**, and **ArduinoJson** from Library Manager.
3. Copy `config.example.h` to `config.h` in this folder. Set Wi-Fi credentials, the backend's reachable LAN base URL, a unique device ID, and an existing batch ID. `config.h` is ignored by Git.
4. Upload `cold_chain_monitor.ino` and open Serial Monitor at 115200 baud.

The default sample interval is 60 seconds. DHT22 should not be polled faster than its supported sampling rate; adjust `SAMPLE_INTERVAL_MS` only after checking the sensor documentation.

## Backend contract

The sketch sends this shape to `POST <BACKEND_BASE_URL>/api/sensor-data`:

```json
{
  "device_id": "ESP32-1",
  "batch_id": "BATCH-...",
  "temperature": 4.2,
  "humidity": 78.5
}
```

This matches the current backend route. It requires a valid existing batch ID; create a batch through the application/backend first and use the returned traceability ID. The route currently accepts unauthenticated sensor submissions, so use this only in a controlled prototype network. The firmware uses plain HTTP; production or internet-facing use needs authenticated device identity and TLS support.

The starter skips failed sensor reads and reports network/API errors over Serial. It does not retain readings for later delivery after an outage, and it does not yet provide device provisioning, secure credentials storage, calibration, or offline buffering.
