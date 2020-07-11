const fs = require('fs');
const util = require('util');
const replaceAll = require("string.prototype.replaceall");

const ls = util.promisify(fs.readdir);

module.exports = async function (options) {
  const {
    owner,
    repo,
    octokit,
    isVerbose,
    isDryRun,
  } = options;
  const replacementsDir = `${__dirname}/replacements`;
  const files = (await ls(replacementsDir)).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const replacementsFn = require(`${replacementsDir}/${file}`);
    const { path, replacements } = await replacementsFn(options);
    try {
      let file = await loadFile(owner, repo, path, octokit);

      let content = file.content;
      for (let r of replacements) {
        const re = new RegExp(r.from, "g");
        content = replaceAll(content, re, r.to);
      }

      if (content !== file.content) {
        if (isVerbose) {
          console.log(`✏️  Updating [${path}]`);
        }
        if (!isDryRun) {
          await writeFile(
            owner,
            repo,
            path,
            content,
            file.sha,
            octokit
          );
        }
      } else {
        if (isVerbose) {
          console.log(`✏️  No changes detected in [${path}]`);
        }
      }
    } catch (e) {
      if (isVerbose) {
        console.log(`✏️  Unable to update [${path}]`);
      }
    }
  }
};

async function loadFile(owner, repo, path, octokit) {
  const {
    data: { sha, content },
  } = await octokit.repos.getContent({
    owner,
    repo,
    path,
  });

  return {
    sha,
    content: Buffer.from(content, "base64").toString(),
  };
}

async function writeFile(owner, repo, path, content, sha, octokit) {
  const { data: file } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `github-default-branch: Update ${path}`,
    content: Buffer.from(content).toString("base64"),
    sha,
  });

  return file;
}
