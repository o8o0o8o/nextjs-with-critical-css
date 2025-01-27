import React from "react";
import { Html, Head, Main, NextScript } from "next/document";
import { join } from "path";
import fs from "fs";

function getCSSPaths(page) {
  switch (true) {
    case page.startsWith("/dynamic"):
      return [
        join("/_next", "static", "css", "dynamic.css"),
        join("/_next", "static", "css", "global.css"),
      ];
    case page === "/":
      return [
        join("/_next", "static", "css", "home.css"),
        join("/_next", "static", "css", "global.css"),
      ];
    default:
      return [join("/_next", "static", "css", "global.css")];
  }
}

function getCriticalCSS(page) {
  const withoutQuery = page.split("?")[0];

  try {
    return (
      <style
        dangerouslySetInnerHTML={{
          __html: fs.readFileSync(
            join(process.cwd(), "beasties", withoutQuery, "styles.css"),
            "utf-8"
          ),
        }}
      />
    );
  } catch (error) {}

  return false;
}

export default function Document(props) {
  const criticalCSS = getCriticalCSS(props.dangerousAsPath);
  const isCriticalCSSMode = process.env.BEASTIES_RUNTIME && criticalCSS;

  return (
    <Html lang="en">
      <Head>
        {isCriticalCSSMode
          ? criticalCSS
          : getCSSPaths(props.dangerousAsPath).map((link) => (
              <link key={link} rel="stylesheet" href={link} />
            ))}
      </Head>
      <body>
        <Main />
        <NextScript />
        {isCriticalCSSMode &&
          getCSSPaths(props.dangerousAsPath).map((link) => (
            <link key={link} rel="stylesheet" href={link} />
          ))}
      </body>
    </Html>
  );
}
