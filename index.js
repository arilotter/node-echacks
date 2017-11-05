const { exec } = require("child_process");
const mkfifo = require("mkfifo").mkfifoSync;
const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const VoiceResponse = require("twilio").twiml.VoiceResponse;

const SIP_FOLDER = path.join(__dirname, "..", "sip", "sip");
const FIFO_PATH = path.join(SIP_FOLDER, "fifo");
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
  try {
    fs.unlinkSync(FIFO_PATH);
  } catch (e) {
    // who cares
  }
  mkfifo(FIFO_PATH, 0600);
  calls[from] = exec(path.join(SIP_FOLDER, "SIP"), () => {
    console.log(`SIP for ${from} exited.`);
  });
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
