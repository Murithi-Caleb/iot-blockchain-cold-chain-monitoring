/*
  Cold-Chain Sensor Node | NodeMCU 1.0 (ESP-12E / ESP-12F, ESP8266) | 115200 baud

  Adapted from "Cold-Chain Storage Manager v4" for the final-year project
  "Blockchain-Enabled IoT System for Produce Traceability and Cold Chain Monitoring".

  What it does
    - Reads two DHT11 sensors (temperature + humidity) and the gas sensors.
    - Every POST_INTERVAL_MS it sends the AVERAGE temperature and humidity to the backend:
        POST http://SERVER_HOST:SERVER_PORT/api/sensor-data
        {"device_id":"...","batch_id":"BATCH-...","temperature":24.5,"humidity":61.0}
      The backend stores the reading, detects excursions against the batch's threshold
      profile, raises alerts and anchors evidence on the blockchain. The dashboard is the
      project's React app; this device only has a tiny status page.
    - Still drives the local cooling fan (relay, with hysteresis) and the LEDs.
    - It never sends made-up values: if no sensor works, it sends nothing.

  Removed from the original (not part of this project's scope, or simulated):
    the built-in dashboard, the simulated ethylene / CO2 / door / battery / GPS values,
    and the local "blockchain" hash chain. The real blockchain lives in the backend.

  Libraries (Library Manager): "DHT sensor library" (Adafruit) + "Adafruit Unified Sensor".
  Everything else ships with the ESP8266 board package.
  Files: this sketch and secrets.h must be in the same folder, named CLB_Backend.
*/
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266mDNS.h>
#include <EEPROM.h>
#include <DHT.h>
#include <math.h>
#include "secrets.h"

// ---------- SETTINGS ----------
#define DEVICE_ID         "ESP8266_NODE_01"
#define POST_INTERVAL_MS  5000UL     // one reading to the backend every 5 s
#define HTTP_TIMEOUT_MS   4000

// Local limits: used ONLY for the fan relay and the alarm LED on the device.
// The backend's threshold profile decides what counts as an excursion / alert.
const float LOCAL_T_MIN = 2.0f,  LOCAL_T_MAX = 8.0f;
const float LOCAL_H_MIN = 40.0f, LOCAL_H_MAX = 85.0f;
const float FAN_HYST = 1.0f;                        // fan turns off at LOCAL_T_MAX - FAN_HYST
const unsigned long FAN_MIN_SWITCH_MS = 10000UL;    // min time between automatic fan changes
const int GAS1_THRESHOLD = 400;                     // analog 0-1023 (local alarm only)

#define RELAY_ACTIVE_LOW true        // most relay modules switch ON when the pin is LOW
#define GAS2_ACTIVE_LOW  true

// ---------- PINS (unchanged from the original wiring) ----------
#define PIN_DHT1     14
#define PIN_DHT2     12
#define PIN_GAS2     13
#define PIN_RELAY    5
#define PIN_ALARM    4
#define PIN_WIFI_LED 15
#define PIN_SYS_LED  2               // onboard LED, active LOW

DHT dht1(PIN_DHT1, DHT11);
DHT dht2(PIN_DHT2, DHT11);
ESP8266WebServer server(80);

// ---------- SAVED SETTING (EEPROM): which batch this device reports for ----------
#define EE_MAGIC 0xC01DCA14UL        // differs from the original firmware, so old data is ignored
struct Stored { uint32_t magic; char batch[28]; };
Stored cfg;

// ---------- STATE ----------
float t1 = 0, h1 = 0, t2 = 0, h2 = 0;
bool ok1 = false, ok2 = false;
uint8_t fail1 = 0, fail2 = 0;
int gasRaw = 0;
bool gas2On = false;
bool relayOn = false;
unsigned long lastRelayChange = 0;
bool alarmNow = false;

int lastCode = 0;                    // last HTTP status from the backend (<=0: no response)
const char* lastNote = "not sent yet";
unsigned long lastPostAt = 0;
unsigned long postsOk = 0, postsFail = 0;

// ---------- HELPERS ----------
bool validBatch(const char* s) {     // BATCH- followed by 1 to 20 digits
  if (strncmp(s, "BATCH-", 6) != 0) return false;
  size_t n = strlen(s + 6);
  if (n < 1 || n > 20) return false;
  for (size_t i = 6; i < 6 + n; i++) if (s[i] < '0' || s[i] > '9') return false;
  return true;
}
void saveCfg() { EEPROM.put(0, cfg); EEPROM.commit(); }
void loadCfg() {
  EEPROM.begin(sizeof(Stored));
  EEPROM.get(0, cfg);
  if (cfg.magic != EE_MAGIC) {
    memset(&cfg, 0, sizeof(cfg));
    cfg.magic = EE_MAGIC;
    strncpy(cfg.batch, DEFAULT_BATCH_ID, sizeof(cfg.batch) - 1);
    saveCfg();
  }
  cfg.batch[sizeof(cfg.batch) - 1] = 0;
  if (!validBatch(cfg.batch)) cfg.batch[0] = 0;
}

bool avgTemp(float& o) { int n = 0; float s = 0; if (ok1) { s += t1; n++; } if (ok2) { s += t2; n++; } if (!n) return false; o = s / n; return true; }
bool avgHum(float& o)  { int n = 0; float s = 0; if (ok1) { s += h1; n++; } if (ok2) { s += h2; n++; } if (!n) return false; o = s / n; return true; }
bool maxTemp(float& o) { bool a = false; if (ok1) { o = t1; a = true; } if (ok2 && (!a || t2 > o)) { o = t2; a = true; } return a; }

// ---------- SENSORS ----------
void readDht() {
  float t = dht1.readTemperature(), h = dht1.readHumidity();
  if (isnan(t) || isnan(h)) { if (++fail1 >= 3) ok1 = false; }
  else { fail1 = 0; ok1 = true; t1 = t; h1 = h; }
  t = dht2.readTemperature(); h = dht2.readHumidity();
  if (isnan(t) || isnan(h)) { if (++fail2 >= 3) ok2 = false; }
  else { fail2 = 0; ok2 = true; t2 = t; h2 = h; }
}
void readGas() {
  long s = 0;
  for (int i = 0; i < 8; i++) s += analogRead(A0);
  gasRaw = s / 8;
  gas2On = (digitalRead(PIN_GAS2) == (GAS2_ACTIVE_LOW ? LOW : HIGH));
}

// ---------- FAN RELAY (automatic, with hysteresis) ----------
void drive(bool on) { digitalWrite(PIN_RELAY, (on != RELAY_ACTIVE_LOW) ? HIGH : LOW); }
void setRelay(bool on) { relayOn = on; drive(on); lastRelayChange = millis(); }
void applyRelay() {
  float tc; bool any = maxTemp(tc);
  bool want = relayOn;
  if (!any) want = true;                              // fail-safe: no sensors -> keep cooling
  else if (tc >= LOCAL_T_MAX) want = true;
  else if (tc <= LOCAL_T_MAX - FAN_HYST) want = false;
  if (want != relayOn && (!any || lastRelayChange == 0 || millis() - lastRelayChange >= FAN_MIN_SWITCH_MS)) setRelay(want);
}

// ---------- LOCAL ALARM LED ----------
void updateAlarm() {
  bool a = false;
  if (ok1 && (t1 < LOCAL_T_MIN || t1 > LOCAL_T_MAX || h1 < LOCAL_H_MIN || h1 > LOCAL_H_MAX)) a = true;
  if (ok2 && (t2 < LOCAL_T_MIN || t2 > LOCAL_T_MAX || h2 < LOCAL_H_MIN || h2 > LOCAL_H_MAX)) a = true;
  if (gasRaw > GAS1_THRESHOLD || gas2On) a = true;
  if (millis() > 8000 && (!ok1 || !ok2)) a = true;    // a sensor has stopped answering
  alarmNow = a;
  digitalWrite(PIN_ALARM, a ? HIGH : LOW);
}

void updateLeds() {
  static unsigned long tw = 0; static bool w = false;
  unsigned long n = millis();
  if (WiFi.status() == WL_CONNECTED) digitalWrite(PIN_WIFI_LED, HIGH);          // solid = connected
  else if (n - tw >= 500) { tw = n; w = !w; digitalWrite(PIN_WIFI_LED, w); }     // blinking = no Wi-Fi
  digitalWrite(PIN_SYS_LED, (n % 1000) < 100 ? LOW : HIGH);                      // heartbeat
}

// ---------- SEND ONE READING TO THE BACKEND ----------
void postReading() {
  float t, h;
  if (!avgTemp(t) || !avgHum(h)) { lastNote = "no working sensor, nothing sent"; return; }
  if (cfg.batch[0] == 0)        { lastNote = "batch ID not set"; return; }
  if (WiFi.status() != WL_CONNECTED) { lastNote = "no Wi-Fi"; return; }

  char url[96];
  snprintf(url, sizeof(url), "http://%s:%d/api/sensor-data", SERVER_HOST, SERVER_PORT);
  String body = String("{\"device_id\":\"") + DEVICE_ID + "\",\"batch_id\":\"" + cfg.batch +
                "\",\"temperature\":" + String(t, 1) + ",\"humidity\":" + String(h, 1) + "}";

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) { lastCode = -1; lastNote = "bad server address"; postsFail++; return; }
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_KEY) > 0) http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(body);
  http.end();

  lastCode = code;
  lastPostAt = millis();
  if (code == 201) { postsOk++; lastNote = "stored by backend"; }
  else {
    postsFail++;
    if (code <= 0) lastNote = "backend unreachable (check IP, port, firewall, same Wi-Fi)";
    else if (code == 400) lastNote = "backend rejected the data (check the batch ID)";
    else lastNote = "unexpected backend reply";
  }
}

// ---------- TINY STATUS PAGE (open http://<device-ip>/ in a browser on the same Wi-Fi) ----------
// No login: anyone on the same network can change the batch ID. Fine for a bench demo.
void handleRoot() {
  float at = 0, ah = 0; bool has = avgTemp(at) && avgHum(ah);
  String s = F("<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
               "<meta http-equiv='refresh' content='3'><title>Sensor node</title></head>"
               "<body style='font-family:system-ui;max-width:34rem;margin:1rem auto;padding:0 1rem;line-height:1.5'>"
               "<h2>Cold-chain sensor node</h2>");
  s += "<p><b>Device:</b> " DEVICE_ID "<br><b>IP:</b> " + WiFi.localIP().toString() + " &middot; Wi-Fi " + String(WiFi.RSSI()) + " dBm</p>";
  s += "<p><b>Batch:</b> " + String(cfg.batch[0] ? cfg.batch : "(not set)") + "</p>";
  s += "<p><b>Average:</b> " + (has ? String(at, 1) + " &deg;C, " + String(ah, 1) + " %" : String("no valid reading")) + "<br>";
  s += "Sensor 1: " + (ok1 ? String(t1, 1) + " &deg;C, " + String(h1, 0) + " %" : String("fault")) + "<br>";
  s += "Sensor 2: " + (ok2 ? String(t2, 1) + " &deg;C, " + String(h2, 0) + " %" : String("fault")) + "</p>";
  s += "<p><b>Backend:</b> " + String(lastNote) + " (code " + String(lastCode) + ")<br>";
  s += "Sent OK: " + String(postsOk) + " &middot; failed: " + String(postsFail) + "</p>";
  s += "<p><b>Fan:</b> " + String(relayOn ? "ON" : "OFF") + " &middot; <b>Local alarm LED:</b> " + String(alarmNow ? "ON" : "off") + "</p>";
  s += F("<form action='/set'><label>Set batch ID<br><input name='batch' placeholder='BATCH-1792439971106' size='28'></label> "
         "<button>Save</button></form></body></html>");
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "text/html", s);
}
void handleSet() {
  String b = server.arg("batch");
  b.trim(); b.toUpperCase();
  if (!validBatch(b.c_str())) { server.send(400, "text/plain", "Batch ID must look like BATCH-1792439971106"); return; }
  strncpy(cfg.batch, b.c_str(), sizeof(cfg.batch) - 1);
  cfg.batch[sizeof(cfg.batch) - 1] = 0;
  saveCfg();
  postsOk = 0; postsFail = 0; lastCode = 0; lastNote = "batch changed";
  Serial.print(F("Batch set to ")); Serial.println(cfg.batch);
  server.sendHeader("Location", "/");
  server.send(303, "text/plain", "");
}

// ---------- SETUP / LOOP ----------
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println(F("\n=== Cold-chain sensor node (backend client) ==="));

  pinMode(PIN_ALARM, OUTPUT);    digitalWrite(PIN_ALARM, LOW);
  pinMode(PIN_WIFI_LED, OUTPUT); digitalWrite(PIN_WIFI_LED, LOW);
  pinMode(PIN_SYS_LED, OUTPUT);  digitalWrite(PIN_SYS_LED, HIGH);
  pinMode(PIN_GAS2, INPUT);

  loadCfg();
  drive(false);                  // relay OFF level before enabling the output
  pinMode(PIN_RELAY, OUTPUT);
  drive(false);

  dht1.begin(); dht2.begin();

  WiFi.mode(WIFI_STA);
  WiFi.hostname("coldchain");
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print(F("Connecting to ")); Serial.println(WIFI_SSID);
  Serial.print(F("Batch: ")); Serial.println(cfg.batch[0] ? cfg.batch : "(not set, use the status page)");

  server.on("/", HTTP_GET, handleRoot);
  server.on("/set", HTTP_GET, handleSet);
  server.onNotFound([]() { server.send(404, "text/plain", "Not found"); });
  server.begin();
}

void loop() {
  static unsigned long lastDht = 0, lastGas = 0, lastPost = 0, lastLog = 0;
  static bool wasConn = false, mdnsOn = false;
  unsigned long now = millis();

  server.handleClient();
  if (mdnsOn) MDNS.update();

  bool conn = (WiFi.status() == WL_CONNECTED);
  if (conn && !wasConn) {
    Serial.print(F("WiFi connected. IP: ")); Serial.println(WiFi.localIP());
    Serial.print(F("Status page: http://")); Serial.println(WiFi.localIP());
    if (!mdnsOn && MDNS.begin("coldchain")) { MDNS.addService("http", "tcp", 80); mdnsOn = true; }
  } else if (!conn && wasConn) Serial.println(F("WiFi lost, reconnecting..."));
  wasConn = conn;

  if (now - lastDht >= 2000 || lastDht == 0) { lastDht = now; readDht(); }
  if (now - lastGas >= 250) { lastGas = now; readGas(); }
  if (now - lastPost >= POST_INTERVAL_MS) { lastPost = now; postReading(); }

  updateAlarm();
  applyRelay();
  updateLeds();

  if (now - lastLog >= 5000) {
    lastLog = now;
    Serial.printf("S1 %.0fC %.0f%% %s | S2 %.0fC %.0f%% %s | gas %d | fan %s | alarm %s | backend %d (%s) ok:%lu fail:%lu\n",
                  t1, h1, ok1 ? "ok" : "FAULT", t2, h2, ok2 ? "ok" : "FAULT", gasRaw,
                  relayOn ? "ON" : "OFF", alarmNow ? "YES" : "no", lastCode, lastNote, postsOk, postsFail);
  }
}
