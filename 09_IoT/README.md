# Preliminary IoT implementation

This starter firmware reads temperature and relative humidity from a DHT22 and an analog gas-sensor output on an ESP32. It reports readings above a configurable gas threshold and switches a fan on when temperature stays above its configured upper limit for the configured duration. Temperature and humidity are submitted to the project's existing `POST /api/sensor-data` endpoint.

## Hardware and wiring

| DHT22 | ESP32 |
|---|---|
| VCC | 3V3 (or the sensor module's supported supply) |
| GND | GND |
| DATA | GPIO 4 by default (`DHT_PIN` in `config.h`) |

| Other device | ESP32 connection |
|---|---|
| Analog gas sensor output | GPIO 34 by default (`GAS_SENSOR_PIN`) |
| Fan relay/MOSFET driver input | GPIO 26 by default (`FAN_PIN`) |
| Gas sensor and driver grounds | ESP32 GND (common ground) |

For a bare DHT22, add a 4.7–10 kΩ pull-up resistor between DATA and VCC. A breakout module may already include one. Confirm the pinout and voltage ratings of the specific module before connecting it.

Drive the fan through a suitably rated transistor/MOSFET or relay module; never power a fan directly from an ESP32 GPIO. Use an external fan supply as required and a flyback diode for a bare DC motor. Ensure the gas module's analog output never exceeds the ESP32 ADC input limit (3.3 V); use a divider or level shifter when required by the module.

## Build and configure

1. Install ESP32 board support in Arduino IDE and select the matching ESP32 board and serial port.
2. Install **DHT sensor library by Adafruit**, **Adafruit Unified Sensor**, and **ArduinoJson** from Library Manager.
3. Copy `config.example.h` to `config.h` in this folder. Set Wi-Fi credentials, the backend's reachable LAN base URL, a unique device ID, an existing batch ID, the produce-specific `TEMP_MAX_C`, and a calibrated gas-sensor threshold. `config.h` is ignored by Git.
4. Upload `cold_chain_monitor.ino` and open Serial Monitor at 115200 baud.

The default sample interval is 60 seconds. DHT22 should not be polled faster than its supported sampling rate; adjust `SAMPLE_INTERVAL_MS` only after checking the sensor documentation.

`TEMP_MAX_C` is an example value and must be replaced with the limit for the produce and monitoring context. The fan turns on only after readings remain at or above this threshold for `TEMP_SUSTAINED_MS` (five minutes by default). It turns off at or below `TEMP_MAX_C - TEMP_HYSTERESIS_C` to avoid rapid relay switching. The check runs at the sample interval, so detection and actuation can occur up to one interval after the sustained duration.

`GAS_ALERT_RAW_THRESHOLD` compares raw ESP32 ADC values (12-bit range) and raises a serial alert when reached. Generic analog gas modules such as MQ-series sensors do not provide calibrated CO₂ ppm readings by themselves; warm-up, calibration, cross-sensitivity, and sensor-specific interpretation are required. Use a calibrated CO₂ sensor and conversion method if ppm-level CO₂ measurements are required.

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

The sketch also includes `gas_raw_adc`, `gas_alert`, and `fan_on` in its request, but the current backend ignores these additional fields and stores only temperature and humidity. Persisting them requires a separate backend schema/API change. The route requires a valid existing batch ID; create a batch through the application/backend first and use the returned traceability ID. It currently accepts unauthenticated sensor submissions, so use this only in a controlled prototype network. The firmware uses plain HTTP; production or internet-facing use needs authenticated device identity and TLS support.

The firmware skips failed temperature/humidity reads and reports network/API errors over Serial. The fan control runs locally even when Wi-Fi is unavailable. It does not retain readings for later delivery after an outage, and it does not yet provide device provisioning, secure credentials storage, calibrated CO₂ ppm measurement, or offline buffering.
