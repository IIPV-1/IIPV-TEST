const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
  let num = req.query.number;
  async function IIPVPair() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    try {
      let IIPVPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      if (!IIPVPairWeb.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, "");
        const code = await IIPVPairWeb.requestPairingCode(num);
        if (!res.headersSent) {
          await res.send({ code });
        }
      }

      IIPVPairWeb.ev.on("creds.update", saveCreds);
      IIPVPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          try {
            await delay(10000);
            const sessionData = fs.readFileSync("./session/creds.json");

            const auth_path = "./session/";
            const user_jid = jidNormalizedUser(IIPVPairWeb.user.id);

            function randomMegaId(length = 6, numberLength = 4) {
              const characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
              let result = "";
              for (let i = 0; i < length; i++) {
                result += characters.charAt(
                  Math.floor(Math.random() * characters.length)
                );
              }
              const number = Math.floor(
                Math.random() * Math.pow(10, numberLength)
              );
              return `${result}${number}`;
            }

            const mega_url = await upload(
              fs.createReadStream(auth_path + "creds.json"),
              `${randomMegaId()}.json`
            );

            const string_session = mega_url.replace(
              "https://mega.nz/file/",
              ""
            );

            const sid = `*IIPV [WhatsApp Bot Constructor]*\n\n👉 ${string_session} 👈\n\n*Este es su ID de sesión, copie este ID y péguelo en el archivo config.js*\n\n*Puede hacer cualquier pregunta usando este enlace*\n\n*wa.me/message/WKGLBR2PCETWD1*\n\n*Puede unirse a nuestro grupo de WhatsApp*\n\n*https://chat.whatsapp.com/GAOhr0qNK7KEvJwbenGivZ*`;
            const mg = `🛑 *No comparta este código con nadie* 🛑`;
            const dt = await IIPVPairWeb.sendMessage(user_jid, {
              image: {
                url: "https://i.ibb.co/jvCtvCBD/Pain.jpg",
              },
              caption: sid,
            });
            const msg = await IIPVPairWeb.sendMessage(user_jid, {
              text: string_session,
            });
            const msg1 = await IIPVPairWeb.sendMessage(user_jid, { text: mg });
          } catch (e) {
            exec("pm2 restart iipv");
          }

          await delay(100);
          return await removeFile("./session");
          process.exit(0);
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          await delay(10000);
          IIPVPair();
        }
      });
    } catch (err) {
      exec("pm2 restart iipv-md");
      console.log("servicio reiniciado");
      IIPVPair();
      await removeFile("./session");
      if (!res.headersSent) {
        await res.send({ code: "Servicio no disponible" });
      }
    }
  }
  return await IIPVPair();
});

process.on("uncaughtException", function (err) {
  console.log("Excepción capturada: " + err);
  exec("pm2 restart iipv");
});

module.exports = router;