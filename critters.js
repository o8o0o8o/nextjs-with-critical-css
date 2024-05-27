const Critters = require("critters");
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

async function processHTMLFile(file, htmlString, skipSave) {
  try {
    const critters = new Critters();
    const html = htmlString || (file && fs.readFileSync(file, "utf-8"));

    // nextjs paths
    const pathPatterns = {
      real: "/.next/static/css",
      original: "/_next/static/css",
    };

    const changedToRealPath = html.replaceAll(
      pathPatterns.original,
      pathPatterns.real
    );

    const inlined = await critters.process(changedToRealPath);

    const restoredNextJSPath = inlined.replaceAll(
      pathPatterns.real,
      pathPatterns.original
    );

    const DOMAfterCritters = parse(restoredNextJSPath);
    const head = DOMAfterCritters.querySelector("head");

    if (head) {
      // delete links in the <head/> that left after critters
      for (const linkInHead of head.querySelectorAll("link")) {
        if (
          linkInHead.attributes?.as === "style" ||
          linkInHead.attributes?.rel === "stylesheet"
        ) {
          linkInHead.remove();
        }
      }
    }

    // we don't save file during runtime
    if (!skipSave) {
      fs.writeFileSync(file, DOMAfterCritters.toString());
    }

    const inlinedStyles = DOMAfterCritters.querySelector("style");

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

if (process.env.CRITTERS_BUILD) {
  console.time("Critters: build job");
  main();
  console.timeEnd("Critters: build job");
}
