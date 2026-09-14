const crypto = require("crypto");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SimulatedSmsProvider {
  constructor(options = {}) {
    this.minDelayMs = Number(options.minDelayMs ?? 100);
    this.maxDelayMs = Number(options.maxDelayMs ?? 500);
    this.failureRate = Math.max(0, Math.min(1, Number(options.failureRate ?? 0.2)));
    this.rateLimitPerMinute = Math.max(1, Number(options.rateLimitPerMinute ?? 10));
    this.windowStartedAt = 0;
    this.windowCount = 0;
    this.random = crypto.createHash("sha256").update(String(options.seed || "fms-sms")).digest();
    this.randomIndex = 0;
  }

  nextRandom() {
    const value = this.random[this.randomIndex % this.random.length] / 255;
    this.randomIndex += 1;
    return value;
  }

  async send(to, body) {
    const startedAt = new Date();
    const now = Date.now();
    if (now - this.windowStartedAt >= 60000) {
      this.windowStartedAt = now;
      this.windowCount = 0;
    }

    const delay = this.minDelayMs + Math.floor(this.nextRandom() * (this.maxDelayMs - this.minDelayMs + 1));
    await sleep(delay);

    const base = {
      provider: "simulated_sms",
      recipient: to,
      message: body,
      requested_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      simulated: true,
    };

    if (this.windowCount >= this.rateLimitPerMinute) {
      const error = new Error("simulated SMS rate limit exceeded");
      error.status = 429;
      error.response = { status: 429, data: { ...base, status: "RATE_LIMITED" } };
      console.warn("[SIMULATED_SMS]", JSON.stringify({ ...base, status: "RATE_LIMITED" }));
      throw error;
    }

    this.windowCount += 1;
    if (this.nextRandom() < this.failureRate) {
      const error = new Error("simulated SMS provider failure");
      error.status = 503;
      error.response = { status: 503, data: { ...base, status: "FAILED" } };
      console.warn("[SIMULATED_SMS]", JSON.stringify({ ...base, status: "FAILED" }));
      throw error;
    }

    const response = { ...base, status: "SENT", message_id: `sim-${Date.now()}-${this.randomIndex}` };
    console.log("[SIMULATED_SMS]", JSON.stringify(response));
    return response;
  }
}

function createSmsProvider(config = {}) {
  const mode = String(config.mode || process.env.SMS_PROVIDER || "simulated").toLowerCase();
  if (mode === "simulated" || mode === "mock") {
    return new SimulatedSmsProvider(config);
  }
  return {
    async send(to, body) {
      if (mode === "twilio") {
        if (!config.twilioClient) throw new Error("Twilio is not configured");
        return config.twilioClient.messages.create({ from: config.from, to, body });
      }
      if (mode === "http_gateway") {
        if (!config.gatewayUrl) throw new Error("HTTP SMS gateway is not configured");
        const axios = require("axios");
        const response = await axios.post(config.gatewayUrl, {
          api_key: config.gatewayApiKey,
          from: config.from,
          to,
          message: body,
        }, { timeout: 10000 });
        return response.data;
      }
      throw new Error(`Unsupported SMS_PROVIDER: ${mode}`);
    },
  };
}

module.exports = { createSmsProvider };
