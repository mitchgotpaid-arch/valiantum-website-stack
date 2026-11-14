// Password input is hidden, and never written to disk.
const { randomBytes, scryptSync } = require("node:crypto");
const readline = require("node:readline");
if (!process.stdin.isTTY)
  throw new Error("Run this command in an interactive terminal.");
process.stdout.write("New password (at least 16 characters): ");
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
let password = "";
process.stdin.on("keypress", (str, key) => {
  if (key.name === "c" && key.ctrl) process.exit(1);
  if (key.name === "return") {
    process.stdin.setRawMode(false);
    if (password.length < 16) {
      console.error("\nUse at least 16 characters.");
      process.exit(1);
    }
    const salt = randomBytes(16).toString("hex");
    console.log(
      "\nPROJECTS_PASSWORD_HASH=" +
        salt +
        ":" +
        scryptSync(password, salt, 64).toString("hex"),
    );
    process.exit(0);
  }
  if (key.name === "backspace") password = password.slice(0, -1);
  else if (str && !key.ctrl && !key.meta) password += str;
});
