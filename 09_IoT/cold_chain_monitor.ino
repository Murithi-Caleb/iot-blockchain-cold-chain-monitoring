/*
 * Preliminary ESP32 + DHT22 cold-chain monitor.
 *
 * Dependencies (Arduino Library Manager):
 *   - DHT sensor library by Adafruit
 *   - Adafruit Unified Sensor
 *   - ArduinoJson
 *
 * Copy config.example.h to config.h and provide local settings before upload.
 */
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

#include "config.h"

#ifndef WIFI_SSID
#error "Set WIFI_SSID in config.h"
#endif
#ifndef WIFI_PASSWORD
#error "Set WIFI_PASSWORD in config.h"
#endif
#ifndef BACKEND_BASE_URL
#error "Set BACKEND_BASE_URL in config.h"
#endif
#ifndef DEVICE_ID
#error "Set DEVICE_ID in config.h"
#endif
#ifndef BATCH_ID
#error "Set BATCH_ID in config.h"
#endif
#ifndef DHT_PIN
#define DHT_PIN 4
#endif
#ifndef DHT_TYPE
#define DHT_TYPE DHT22
#endif
#ifndef SAMPLE_INTERVAL_MS
#define SAMPLE_INTERVAL_MS 60000UL
#endif
#ifndef GAS_SENSOR_PIN
#define GAS_SENSOR_PIN 34
#endif
#ifndef FAN_PIN
#define FAN_PIN 26
#endif
#ifndef FAN_ACTIVE_LEVEL
#define FAN_ACTIVE_LEVEL HIGH
#endif
#ifndef FAN_INACTIVE_LEVEL
#define FAN_INACTIVE_LEVEL LOW
#endif
#ifndef TEMP_MAX_C
#error "Set TEMP_MAX_C in config.h to the upper limit for the monitored produce"
#endif
#ifndef TEMP_HYSTERESIS_C
#define TEMP_HYSTERESIS_C 1.0f
#endif
#ifndef TEMP_SUSTAINED_MS
#define TEMP_SUSTAINED_MS 300000UL
#endif
#ifndef GAS_ALERT_RAW_THRESHOLD
#error "Set GAS_ALERT_RAW_THRESHOLD in config.h after calibrating the gas sensor"
#endif

static constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 20000;
static constexpr uint32_t HTTP_TIMEOUT_MS = 10000;

DHT dht(DHT_PIN, DHT_TYPE);
uint32_t lastSampleAt = 0;
uint32_t highTemperatureSince = 0;
bool highTemperatureTiming = false;
bool fanIsOn = false;

String sensorEndpoint() {
  String baseUrl = BACKEND_BASE_URL;
  while (baseUrl.endsWith("/")) {
    baseUrl.remove(baseUrl.length() - 1);
  }
  return baseUrl + "/api/sensor-data";
}

bool connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         static_cast<uint32_t>(millis() - startedAt) < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi unavailable; this reading will be skipped.");
    return false;
  }

  Serial.print("Connected; IP address: ");
  Serial.println(WiFi.localIP());
  return true;
}

bool postReading(float temperature, float humidity, int gasRaw, bool gasAlert, bool fanOn) {
  if (!connectToWiFi()) {
    return false;
  }

  JsonDocument document;
  document["device_id"] = DEVICE_ID;
  document["batch_id"] = BATCH_ID;
  document["temperature"] = temperature;
  document["humidity"] = humidity;
  // The current API stores only its four documented fields; these extra fields
  // are ready for a later backend schema update and remain visible in Serial.
  document["gas_raw_adc"] = gasRaw;
  document["gas_alert"] = gasAlert;
  document["fan_on"] = fanOn;

  String payload;
  serializeJson(document, payload);

  WiFiClient wifiClient;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  const String endpoint = sensorEndpoint();
  if (!http.begin(wifiClient, endpoint)) {
    Serial.println("Could not initialize the HTTP connection.");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  const int statusCode = http.POST(payload);
  const String response = statusCode > 0 ? http.getString() : http.errorToString(statusCode);
  http.end();

  Serial.printf("POST %s -> HTTP %d\n", endpoint.c_str(), statusCode);
  if (response.length() > 0) {
    Serial.println(response);
  }
  return statusCode >= 200 && statusCode < 300;
}

void updateFan(float temperature, uint32_t now) {
  if (temperature >= TEMP_MAX_C) {
    if (!highTemperatureTiming) {
      highTemperatureTiming = true;
      highTemperatureSince = now;
      Serial.println("Temperature above limit; sustained-rise timer started.");
    }

    if (!fanIsOn && static_cast<uint32_t>(now - highTemperatureSince) >= TEMP_SUSTAINED_MS) {
      digitalWrite(FAN_PIN, FAN_ACTIVE_LEVEL);
      fanIsOn = true;
      Serial.println("Sustained high temperature: fan switched ON.");
    }
    return;
  }

  // Any dip below the upper limit breaks the sustained-rise period. Keep an
  // already-running fan on until the lower hysteresis reset point is reached.
  highTemperatureTiming = false;
  highTemperatureSince = 0;
  if (fanIsOn && temperature <= TEMP_MAX_C - TEMP_HYSTERESIS_C) {
    digitalWrite(FAN_PIN, FAN_INACTIVE_LEVEL);
    fanIsOn = false;
    Serial.println("Temperature returned below reset point: fan switched OFF.");
  }
}

void collectAndSendReading() {
  const int gasRaw = analogRead(GAS_SENSOR_PIN);
  const bool gasAlert = gasRaw >= GAS_ALERT_RAW_THRESHOLD;
  Serial.printf("Gas ADC: %d | Gas alert: %s\n", gasRaw, gasAlert ? "YES" : "no");
  if (gasAlert) {
    Serial.println("Gas sensor reading is above its configured raw threshold.");
  }

  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();

  if (!isfinite(temperature) || !isfinite(humidity)) {
    Serial.println("DHT22 returned an invalid reading; skipping transmission.");
    return;
  }

  const uint32_t now = millis();
  updateFan(temperature, now);

  Serial.printf("Temperature: %.1f C | Humidity: %.1f %% | Fan: %s\n",
                temperature, humidity, fanIsOn ? "ON" : "OFF");

  if (!postReading(temperature, humidity, gasRaw, gasAlert, fanIsOn)) {
    Serial.println("Reading was not accepted by the backend.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(FAN_PIN, FAN_INACTIVE_LEVEL);
  analogReadResolution(12);
  pinMode(GAS_SENSOR_PIN, INPUT);
  dht.begin();
  Serial.println("Cold-chain ESP32 monitor starting.");
  Serial.printf("Device: %s | Batch: %s\n", DEVICE_ID, BATCH_ID);
  Serial.printf("Temperature upper limit: %.1f C; fan delay: %lu seconds\n",
                static_cast<double>(TEMP_MAX_C),
                static_cast<unsigned long>(TEMP_SUSTAINED_MS / 1000UL));

  // DHT22 needs a short settling time after power-up.
  delay(2000);
  collectAndSendReading();
  lastSampleAt = millis();
}

void loop() {
  if (static_cast<uint32_t>(millis() - lastSampleAt) >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = millis();
    collectAndSendReading();
  }
  delay(50);
}
