// Postman collection ko terminal se chalao (Newman) + HTML report
// chalao (backend/ se, server pehle se chal raha ho): npm run test:postman
// staging: npm run test:postman -- staging (us ka test data us server ke DB mein rehta hai, yahan se nahi mitta)
const path = require("path");
const { spawnSync } = require("child_process");
const newman = require("newman");
const config = require("../src/config");

const envName = process.argv[2] || "local";
const postmanDir = path.join(__dirname, "../../postman");
const reportPath = path.join(postmanDir, "reports", `report-${envName}.html`);

newman.run(
  {
    collection: path.join(postmanDir, "Node-Backend-API.postman_collection.json"),
    environment: path.join(postmanDir, "environments", `${envName}.postman_environment.json`),
    // API key file mein nahi (commit hoti hai) — .env se yahan di jaati hai
    envVar: [{ key: "apiKey", value: config.apiKey }],
    // file uploads (fixtures/sample.png) isi folder ke hisaab se
    workingDir: postmanDir,
    reporters: ["cli", "htmlextra"],
    reporter: {
      htmlextra: { export: reportPath, title: `Node Backend API — ${envName}`, browserTitle: "API test report" }
    }
  },
  (err, summary) => {
    if (err) {
      console.error("Newman run failed:", err.message);
      process.exit(1);
    }

    const failures = summary.run.failures.length;
    console.log(`\nHTML report: ${reportPath}`);

    // local DB ka test data foran saaf — pass ho ya fail (fail run bhi users bana chuka hota hai)
    if (envName === "local") {
      const result = spawnSync(process.execPath, ["--env-file=.env", path.join(__dirname, "postman-cleanup.js")], {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit"
      });
      if (result.status !== 0) process.exitCode = 1;
    }

    if (failures > 0) process.exitCode = 1;
  }
);
