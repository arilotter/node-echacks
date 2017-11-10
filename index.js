const { exec, spawn } = require("child_process");
const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const VoiceResponse = require("twilio").twiml.VoiceResponse;

const ON_DEATH = require("death");

const BAUD_RATE = 100;
const SIP_FOLDER = path.join(__dirname, "sip");

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
  const sip = spawn(path.join(SIP_FOLDER, "sip"), [], { shell: true });
  // const mod = spawn(
  //   "minimodem",
  //   ["--tx", "--alsa=plughw:0,0,0", "--tx-carrier", BAUD_RATE],
  //   { shell: true }
  // );
  const demod = spawn("minimodem", ["--rx", "--alsa=plughw:0,1,0", BAUD_RATE], {
    shell: true
  });
  sip.stdout.on("data", data => {
    console.log(data.toString("utf8"));
  });
  sip.stderr.on("data", data => {
    console.log(data.toString("utf8"));
  });
  const pr = data => {
    console.log(data.toString("utf8"));
    // echo any input, reversed
    // mod.stdin.write(
    //   Buffer.from(
    //     data
    //       .toString("utf8")
    //       .split("")
    //       .reverse()
    //       .join(""),
    //     "utf8"
    //   )
    // );
  };
  demod.stdout.on("data", pr);
  demod.stderr.on("data", pr);
  sip.on("close", () => {
    // console.log(`SIP for ${from} closed.`);
    // mod.kill();
    demod.kill();
    delete calls[from];
  });

  calls[from] = { sip, mod, demod };

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
    if (!calls[body.From]) {
      console.log(
        "error: tried to kill a sip instance that doesn't exist. wat."
      );
    } else {
      const { sip, mod, demod } = calls[body.From];
      console.log(`Killing SIP for ${body.From}`);
      sip.kill();
    }
  }
  res.send("ok");
});

app.listen(80, "0.0.0.0");

console.log("TwiML server running at http://127.0.0.1:80/");

ON_DEATH(function(signal, err) {
  Object.values(calls).forEach(({ sip, demod }) => {
    sip.kill();
    demod.kill();
  });
});
