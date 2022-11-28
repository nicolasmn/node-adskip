const { Socket } = require("net");
const { Transform } = require("stream");
const Jimp = require("jimp");
const ndjson = require("ndjson");
const pyatvModule = import("@sebbo2002/node-pyatv");

require("dotenv").config();

const {
  HYPERION_HOST,
  HYPERION_PORT,
  APPLETV_HOST,
  AIRPLAY_CREDENTIALS,
  COMPANION_CREDENTIALS,
  PIP_PATH,
} = process.env;

try {
  adDetector({
    crop: [291, 202, 8, 9],
    hyperion: {
      host: HYPERION_HOST,
      port: HYPERION_PORT,
    },
    appletv: {
      host: APPLETV_HOST,
      airplayCredentials: AIRPLAY_CREDENTIALS,
      companionCredentials: COMPANION_CREDENTIALS,
      atvremotePath: PIP_PATH ? PIP_PATH + "/atvremote" : undefined,
      atvscriptPath: PIP_PATH ? PIP_PATH + "/atvscript" : undefined,
    },
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}

const comp = Jimp.read("./comp.png");

async function adDetector(config) {
  const { default: pyatv } = await pyatvModule;
  pyatv.check();

  const device = pyatv.device(config.appletv);

  let currentApp,
    currentState,
    adDetected = false;

  const hyperionStream = new HyperionStream(config.hyperion);
  const diffStream = hyperionStream.client.pipe(ndjson.parse()).pipe(diff);

  diffStream.on("data", (diff) => {
    // console.debug(diff);

    if (diff.percent < 0.05) {
      if (!adDetected) {
        process.stdout.write("Skipping ad… ");
        console.time("time");
        device.select().then(() => {
          process.stdout.write("done in ");
          console.timeEnd("time");
        });
        adDetected = true;
      }
    } else {
      adDetected = false;
    }
  });

  device.on("update:deviceState", (event) => {
    if (event instanceof Error) return;
    currentState = event.value;
    callback();
  });

  device.on("update:app", async (event) => {
    if (event instanceof Error) return;
    currentApp = event.value;
    callback();
  });

  function callback() {
    if (currentState === "playing" && currentApp === "YouTube") {
      console.info("Watching for ads…");
      hyperionStream.start();
    } else if (hyperionStream.streaming) {
      console.info("Stop watching for ads");
      hyperionStream.stop();
    }
  }
}

const diff = new Transform({
  objectMode: true,
  transform: async (data, enc, done) => {
    // console.debug(data);

    if (data.command === "ledcolors-imagestream-update") {
      const { image } = data.result;
      const buffer = Buffer.from(
        image.substring("data:image/jpg;base64,".length),
        "base64"
      );

      const stream = await Jimp.read(buffer).then((img) => {
        return img.crop(291, 202, 8, 9);
      });

      // stream.write("./stream.png");

      const diff = Jimp.diff(stream, await comp);

      done(null, diff);
    } else {
      done(null);
    }
  },
});

class HyperionStream {
  constructor(options) {
    this.options = options;
    this.client = new Socket();
    this.streaming = false;

    this.client.on("connect", () => {
      console.log("Connected to Hyperion");
    });

    this.client.on("close", () => {
      console.log("Connection to Hyperion closed");
    });

    this.client.on("error", (error) => {
      throw new Error(error);
    });

    this.client.on("timeout", () => {
      this.client.destroy("Connection to Hyperion timed out");
    });

    this.client.connect(this.options);

    process.on("SIGINT", () => {
      this.client.end(process.exit);
    });
  }

  send(command) {
    const string = JSON.stringify(command) + "\n";
    this.client.write(string);

    return this.client;
  }

  start() {
    this.streaming = true;

    return this.send({
      command: "ledcolors",
      subcommand: "imagestream-start",
    });
  }

  stop() {
    this.send({
      command: "ledcolors",
      subcommand: "imagestream-stop",
    });

    this.streaming = false;
  }
}
