const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const zlib = require("zlib");
const { join } = require("path");
const { processHTMLFile } = require("./critters");

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "example.com";
const port = 3000;
const app = next({ dev, port, hostname });
const handle = app.getRequestHandler();
const DIR = "critters";
const processedRoutes = new Set();
const routes = {};
const cachingTime = 5 * 60 * 1000; // 5 min

try {
  console.time("Critters: runtime prepare");

  // delete the folder if it remains from the previous runtime
  fs.rmSync(DIR, { recursive: true, force: true });

  // create a folder for critical styles collected at runtime, recreating the nextJS pages structure
  fs.cpSync("pages", DIR, {
    recursive: true,
    overwrite: true,
    filter: function (source) {
      if (source.includes(".")) {
        return false;
      }

      return true;
    },
  });

  const processedHTMLFiles = fs.readFileSync(
    join(process.cwd(), "processedRoutes.json"),
    "utf-8"
  );

  // add the processed routes to a Set to be able to check at runtime
  JSON.parse(processedHTMLFiles).forEach((file) => processedRoutes.add(file));

  console.timeEnd("Critters: runtime prepare");
} catch (error) {}

async function saveStylesToFile(html, path) {
  const folder = DIR + path;
  const styles = await processHTMLFile(path, html, true);

  // folder to mimic routes structure in nextJS
  fs.mkdir(folder, { recursive: true }, () => {
    const filePath = join(folder, "styles.css");

    fs.writeFile(filePath, styles, (err) => {
      if (err) {
        console.error("Error saving styles to file:", err);
      } else {
        console.log("styles saved to file:", filePath);
      }
    });

    console.timeEnd("Critters: runtime");
  });
}

app.prepare().then(() => {
  createServer((req, res) => {
    // get current route
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // if the route was not processed or the cache is stale
    if (
      !processedRoutes.has(pathname) ||
      Date.now() - routes[pathname] > cachingTime
    ) {
      const originalWrite = res.write;
      const chunks = [];

      res.write = function (chunk) {
        if (
          res.statusCode === 200 &&
          res.getHeader("content-type")?.includes("text/html")
        ) {
          // html is served in chunks, so we need to collect those chunks
          chunks.push(chunk);
        }

        originalWrite.apply(res, arguments);
      };

      // after we sent html to a user
      res.on("finish", () => {
        if (
          res.statusCode === 200 &&
          res.getHeader("content-type")?.includes("text/html")
        ) {
          // add route to processedRoutes
          processedRoutes.add(pathname);

          // put in task queue
          setTimeout(() => {
            console.time("Critters: runtime");

            // combine all chunks
            const html = Buffer.concat(chunks);

            // the data is compressed by default, so we need to decompress it to be able to process it
            zlib.unzip(html, (err, decompressedData) => {
              if (err) {
                console.error("Error decompressing data:", err);
                return;
              }
              // start processing html
              saveStylesToFile(decompressedData.toString(), pathname);

              // update cache time
              routes[pathname] = Date.now();
            });
          }, 0);
        }
      });
    }

    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
