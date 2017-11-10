const { exec, spawn } = require("child_process");
const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const VoiceResponse = require("twilio").twiml.VoiceResponse;

const SIP_FOLDER = path.join(__dirname, "sip");
const BAUD_RATE = 30;
const DEMODULATOR_COMMAND = [
  "minimodem",
  ["--rx", "--alsa=plughw:0,1,0", BAUD_RATE]
];
const MODULATOR_COMMAND = [
  "minimodem",
  ["--tx", "--alsa=plughw:0,0,0", BAUD_RATE]
];
const calls = {};

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.get("/", (req, res) => {
  res.send("hello!");
});

app.post("/call", (req, res) => {
  const from = req.body.From;
  // This is a regular, from-a-telephone call - start the SIP call.
  console.log(`New call from ${from}`);
  console.log("Starting SIP...");
// SIP NEEDS `sudo modprobe snd-aloop` !
  const sip = spawn(path.join(SIP_FOLDER, "sip"));
  const mod = spawn(...MODULATOR_COMMAND);
  const demod = spawn(...DEMODULATOR_COMMAND);

  demod.stdout.on("data", data => {
    console.log(data.toString("utf8"));
    // echo any input, reversed
    mod.stdin.write(
      data
        .toString("utf8")
        .split("")
        .reverse()
        .join("")
    );
  });
  sip.on("close", () => {
    console.log(`SIP for ${from} closed.`);
    mod.kill();
    demod.kill();
    clearTimeout(sendTimer);
    delete calls[from];
  });

  calls[from] = { sip, mod, demod, sendTimer };

  // Create TwiML response
  const twiml = new VoiceResponse();
  const dial = twiml.dial();

  dial.conference("some-conference", {
    startConferenceOnEnter: true,
    endConferenceOnExit: true
  });

  res.set("Content-Type", "text/xml");
  res.send(twiml.toString());
});

app.post("/sip", (req, res) => {
  // Create TwiML response
  const twiml = new VoiceResponse();
  const dial = twiml.dial();

  dial.conference("some-conference", {
    startConferenceOnEnter: true,
    endConferenceOnExit: true
  });

  res.set("Content-Type", "text/xml");
  res.send(twiml.toString());
  console.log(`SIP connected.`);
});

app.post("/status", ({ body }, res) => {
  console.log(body);
  if (body.CallStatus === "completed") {
    const sip = calls[body.From];
    if (sip) {
      console.log(`Killing SIP for ${body.From}`);
      sip.kill();
    } else {
      console.log(
        "error: tried to kill a sip instance that doesn't exist. wat."
      );
    }
  }
  res.send("ok");
});

app.listen(80, "0.0.0.0");

console.log("TwiML server running at http://127.0.0.1:80/");
process.on("exit", () => {
  calls.keys().forEach(num => calls[num].kill());
});
