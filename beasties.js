const Beasties = require("beasties");
const { join } = require("path");
const fs = require("fs");
const { parse } = require("node-html-parser");

// Recursive function to get files
function getHTMLFiles(dir, files = []) {
  // Get an array of all files and directories in the passed directory using fs.readdirSync
  const fileList = fs.readdirSync(dir);
  // Create the full path of the file/directory by concatenating the passed directory and file/directory name
  for (const file of fileList) {
    const name = `${dir}/${file}`;
    // Check if the current file/directory is a directory using fs.statSync
    if (fs.statSync(name).isDirectory()) {
      // If it is a directory, recursively call the getFiles function with the directory path and the files array
      getHTMLFiles(name, files);
    } else {
      // If it is an HTML file, push the full path to the files array
      if (name.endsWith("html")) {
        files.push(name);
      }
    }
  }

  return files;
}

async function processHTMLFile(file, htmlString, runtime) {
  try {
    const beasties = new Beasties();
    // we don't read file at runtime
    const html = htmlString || (file && fs.readFileSync(file, "utf-8"));

    // nextJS paths
    const pathPatterns = {
      real: "/.next/static/css",
      original: "/_next/static/css",
    };

    const changedToRealPath = html.replaceAll(
      pathPatterns.original,
      pathPatterns.real
    );

    const inlined = await beasties.process(changedToRealPath);

    const restoredNextJSPath = inlined.replaceAll(
      pathPatterns.real,
      pathPatterns.original
    );

    const DOMAfterBeasties = parse(restoredNextJSPath);
    const head = DOMAfterBeasties.querySelector("head");

    if (head) {
      // delete links in the <head/> that left after beasties
      for (const linkInHead of head.querySelectorAll("link")) {
        if (
          linkInHead.attributes?.as === "style" ||
          linkInHead.attributes?.rel === "stylesheet"
        ) {
          linkInHead.remove();
        }
      }
    }

    // save HTML file in runtime, only for ISR https://nextjs.org/docs/pages/building-your-application/data-fetching/incremental-static-regeneration
    if (runtime === "ISR") {
      const filePath = join(
        process.cwd(),
        ".next",
        "server",
        "pages",
        file + ".html"
      );

      fs.writeFile(filePath, DOMAfterBeasties.toString(), (err) => {
        if (err) {
          console.error("Error saving the HTML file:", err);
        } else {
          console.log("The HTML file has been saved: ", filePath);
        }
      });
      // we don't save file in SSR
    } else if (runtime !== "SSR") {
      fs.writeFileSync(file, DOMAfterBeasties.toString());
    }

    const inlinedStyles = DOMAfterBeasties.querySelector("style");

    // return critical css
    return inlinedStyles.text;
  } catch (error) {}
}

async function main() {
  const currentFolder = join(process.cwd(), ".next");
  const files = getHTMLFiles(currentFolder);
  const processedRoutes = [];

  for (const file of files) {
    const slug = file.split(".next/server/pages")[1];

    await processHTMLFile(file);

    processedRoutes.push(slug.replace(".html", "").replace("index", ""));
  }

  fs.writeFileSync(
    join(process.cwd(), "processedRoutes.json"),
    JSON.stringify(processedRoutes)
  );
}

module.exports = { processHTMLFile };

if (process.env.BEASTIES_BUILD) {
  console.time("Beasties: build job");
  main();
  console.timeEnd("Beasties: build job");
}
