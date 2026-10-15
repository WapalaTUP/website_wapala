export function assertInteractive(args: string[], tty: boolean) {
  if (args.length || !tty)
    throw new Error(
      "Gunakan terminal interaktif; password tidak boleh menjadi argumen.",
    );
}
export function hiddenPassword(prompt: string): Promise<string> {
  assertInteractive([], !!process.stdin.isTTY && !!process.stdout.isTTY);
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("data", read);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
      value = "";
    };
    const read = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish(new Error("Dibatalkan."));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\u007f" || char === "\b")
          value = Array.from(value).slice(0, -1).join("");
        else if (char >= " ") value += char;
        if (Buffer.byteLength(value) > 1024) {
          finish(new Error("Password terlalu panjang."));
          return;
        }
      }
    };
    process.stdin.on("data", read);
  });
}
