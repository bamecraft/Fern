import { Command } from "https://deno.land/x/cliffy@v0.20.1/command/mod.ts";
import { download } from "https://deno.land/x/download@v1.0.1/mod.ts";
import { exec } from "https://deno.land/x/exec@0.0.5/mod.ts";
import { readZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";
import * as path from "https://deno.land/std@0.125.0/path/mod.ts";
import * as color from "https://deno.land/std@0.125.0/fmt/colors.ts";

let config: {
  config_version: string;
  root_directory: string;
  update_pre_script: string;
  update_post_script: string;
  providers: {
    [x: string]: {
      update_check_url: string;
      update_check_query: string;
      skip_update_check: boolean;
      download_url: string;
    };
  };
  use_latest: [{
    name: string;
    comment: string;
    provider: string;
    relative_directory: string;
    pre_script: string;
    post_script: string;
    [x: string]: string | number | boolean;
  }];
};
let pot: { [x: string]: { version: string | number } };

function CreateUrlFromTemplate(
  template: string,
  variables: { [x: string]: string | number | boolean },
) {
  do {
    template = template.replace(/{([^{]+)}/g, (_, varName: string) => {
      if (variables[varName] == null) {
        throw (`${varName} is not defined!`);
      }
      return variables[varName] == null ? "" : String(variables[varName]);
    });
  } while (template.includes("{"));
  return template;
}

async function EggcrackPluginJar(jarPath: string) {
  const zip = await readZip(jarPath);
  const pluginYml: string = (await zip.file("plugin.yml").async("string"))
    .replace(/\r\n|\r/g, "\n");
  const pluginVersion: string = pluginYml.match(/version: (.*)/)![1];
  return pluginVersion;
}

async function GetLocalVersion(pluginName: string) {
  pluginName = pluginName.toLowerCase();
  if (pot[pluginName]) {
    return pot[pluginName].version;
  } else {
    for await (
      const entry of Deno.readDir(path.join(config.root_directory, "plugins"))
    ) {
      if (
        entry.isFile &&
        entry.name.toLowerCase().includes(pluginName.toLowerCase())
      ) {
        return await EggcrackPluginJar(
          path.join(config.root_directory, "plugins", entry.name),
        );
      }
    }
    return 0;
  }
}

async function GetLatestVersion(
  item: { provider: string; [x: string]: string | number | boolean },
) {
  const url: string = CreateUrlFromTemplate(
    config.providers[item.provider].update_check_url,
    item,
  );
  let result = (await (await fetch(url)).json());
  config.providers[item.provider].update_check_query.split(".").forEach(
    (x: string | number) => {
      if (typeof (x) == "string" && x.startsWith("-")) {
        result = result[result.length - Number(x.slice(1))];
      } else {
        result = result[x];
      }
    },
  );
  return result;
}

async function DownloadFile(url: string, destination: string) {
  console.log(`Downloading ${color.green(url)} to ${color.green(destination)}`);
  await download(url, {
    dir: path.dirname(destination),
    file: path.basename(destination),
  })
    .catch((err) => {
      console.log(`[${path.basename}]    ${err}`);
    });
}

async function CheckUpdate() {
  try {
    for (const item of config.use_latest) {
      console.log(`Checking ${item.name} from ${item.provider}`);

      if (item.pre_script) {
        console.log(color.gray(`Executing Pre-Script: ${item.pre_script}`));
        await exec(item.pre_script);
      }

      if (!config.providers[item.provider]) {
        throw (`${item.provider} is not defined in providers list`);
      } else {
        if (!config.providers[item.provider].update_check_url) {
          if (
            config.providers[item.provider].skip_update_check &&
            config.providers[item.provider].skip_update_check == true
          ) {
            console.log("Skipping update check...");
            await DownloadFile(
              CreateUrlFromTemplate(
                config.providers[item.provider].download_url,
                item,
              ),
              path.resolve(
                path.join(
                  config.root_directory,
                  item.relative_directory,
                  `${item.name}.jar`,
                ),
              ),
            );
          } else {
            throw (`update_check_url is not defined in provider: ${item.provider}`);
          }
        } else {
          const latest = await GetLatestVersion(item);
          const local = await GetLocalVersion(item.name);

          const latestVersion = typeof (latest) == "string"
            ? latest.split(".")
            : latest;
          const localVersion = typeof (local) == "string"
            ? local.split(".")
            : local;

          if (latestVersion > localVersion) {
            item["VERSION"] = latest;
            await DownloadFile(
              CreateUrlFromTemplate(
                config.providers[item.provider].download_url,
                item,
              ),
              path.resolve(
                path.join(
                  config.root_directory,
                  item.relative_directory,
                  `${item.name}.jar`,
                ),
              ),
            );
            pot[(item.name).toLowerCase()].version = latest;
            console.log(`    Updated ${local} -> ${latest}`);
          } else {
            console.log(`    ${local} is latest`);
          }
        }
      }

      if (item.post_script) {
        console.log(color.gray(`Executing Post-Script: ${item.post_script}`));
        await exec(item.post_script);
      }
    }
  } catch (e) {
    console.log(
      color.bold(color.red("Error: An error occured while update command.")),
    );
    console.log("Please make sure that your fern.json is written correctly.");
    console.log(color.gray(e.message));
    Deno.exit(1);
  }
}

await new Command()
  .name("fern")
  .version("0.2")
  .description("MeaaC (Minecraft environment as a Code) utility tool.")
  .option(
    "-c, --config-location <Directory:string>",
    "Specify config location.",
    { default: "./", global: true },
  )
  .option("-p, --profile-name <Name:string>", "Specify profile name.", {
    default: "fern",
    global: true,
  })
  .command("update", "Update environment to latest.")
  .action(
    async (
      options: { [options: string]: string | number | boolean },
      _args: string[],
    ) => {
      console.log(color.bold(color.green("Starting update...")));

      try {
        config = JSON.parse(
          await Deno.readTextFile(
            path.resolve(
              path.join(
                `${options.configLocation}`,
                `${options.profileName}.json`,
              ),
            ),
          ),
        );
      } catch (e) {
        console.log(
          color.bold(color.red("Error: Failed to load / parse config file.")),
        );
        console.log("You might want to run `fern init` first.");
        console.log(color.gray(e.message));
        Deno.exit(1);
      }
      try {
        pot = JSON.parse(
          await Deno.readTextFile(
            path.resolve(
              path.join(
                `${options.configLocation}`,
                `${options.profileName}-pot.json`,
              ),
            ),
          ),
        );
      } catch (e) {
        console.log(
          color.bold(color.red("Error: Failed to load / parse pot file.")),
        );
        console.log("You might want to run `fern init` first.");
        console.log(color.gray(e.message));
        Deno.exit(1);
      }

      if (config.update_pre_script) {
        console.log(
          color.gray(
            `Executing Update Pre-Script: ${config.update_pre_script}`,
          ),
        );
        await exec(config.update_pre_script);
      }

      await CheckUpdate();
      await Deno.writeTextFile(
        path.resolve(
          path.join(
            `${options.configLocation}`,
            `${options.profileName}-pot.json`,
          ),
        ),
        JSON.stringify(pot),
      );

      if (config.update_post_script) {
        console.log(
          color.gray(
            `Executing Update Post-Script: ${config.update_post_script}`,
          ),
        );
        await exec(config.update_post_script);
      }
    },
  )
  .command("init", "Initialize environment.")
  .action(async (
    options: { [options: string]: string | number | boolean },
    _args: string[],
  ) => {
    try {
      await Deno.create(path.resolve(
        path.join(
          `${options.configLocation}`,
          `${options.profileName}.json`,
        ),
      ));

      await Deno.create(
        path.resolve(
          path.join(
            `${options.configLocation}`,
            `${options.profileName}-pot.json`,
          ),
        ),
      );
    } catch (e) {
      console.log(
        color.bold(color.red("Error: Failed to initialize.")),
      );
      console.log(color.gray(e.message));
      Deno.exit(1);
    }
  })
  .reset()
  .parse(Deno.args);
