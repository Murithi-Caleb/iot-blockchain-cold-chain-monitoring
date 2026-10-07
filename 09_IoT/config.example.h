// Copy this file to config.h and fill in values for your local device.
// Keep config.h private; 09_IoT/.gitignore excludes it from Git.
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// Use the host machine's LAN address when the ESP32 and backend share a network.
// Example: "http://192.168.1.20:5000"
#define BACKEND_BASE_URL "http://192.168.1.20:5000"

#define DEVICE_ID "ESP32-1"
// Use an existing traceability ID returned by POST /api/batches.
#define BATCH_ID "BATCH-REPLACE_WITH_EXISTING_ID"

#define DHT_PIN 4
#define DHT_TYPE DHT22
#define SAMPLE_INTERVAL_MS 60000UL

// Analog gas sensor module output. This is a raw ADC threshold, not CO2 ppm.
#define GAS_SENSOR_PIN 34
#define GAS_ALERT_RAW_THRESHOLD 1800

// Relay/MOSFET driver input for a fan. Adjust polarity for the driver module.
#define FAN_PIN 26
#define FAN_ACTIVE_LEVEL HIGH
#define FAN_INACTIVE_LEVEL LOW

// Provisional example only: set the upper limit for the produce being monitored.
#define TEMP_MAX_C 8.0f
#define TEMP_HYSTERESIS_C 1.0f
#define TEMP_SUSTAINED_MS 300000UL
