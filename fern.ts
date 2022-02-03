import { Command } from "https://deno.land/x/cliffy/command/mod.ts";
import { download } from 'https://deno.land/x/download/mod.ts';
import { readZip } from 'https://deno.land/x/jszip/mod.ts';
import * as path from "https://deno.land/std/path/mod.ts";
import * as color from "https://deno.land/std/fmt/colors.ts";

function CreateUrlFromTemplate(template: string, variables: { [x: string]: string; })
{
	return template.replace(/{([^{]+)}/g, (_, varName: string) =>
	{
		if(variables[varName] == null)
		{
			throw (`${varName} is not defined!`);
		}
		return variables[varName] == null ? '' : variables[varName];
	});
}

async function EggcrackPluginJar(jarPath: string)
{
	const zip = await readZip(jarPath);
	const pluginYml: string = (await zip.file('plugin.yml').async('string')).replace(/\r\n|\r/g,'\n');
	const pluginName: string = pluginYml.match(/name: (.*)/)![1];
	const pluginVersion: string = pluginYml.match(/version: (.*)/)![1];

	console.log(pluginName);
	console.log(pluginVersion);
}

async function GetLocalVersion(config: any, pot: any, pluginName: string)
{
	pluginName = pluginName.toLowerCase();
	if(pot[pluginName])
	{
		return pot[pluginName].version;
	}
	else
	{
		for await (const entry of Deno.readDir(path.join(config.root_directory, 'plugins')))
		{
			if(entry.isFile && entry.name.toLowerCase().includes(pluginName.toLowerCase()))
			{
				EggcrackPluginJar(path.join(config.root_directory, 'plugins', entry.name))
			}
		}
	}
}

async function GetLatestVersion(config: any, item: any)
{
	const url: string = CreateUrlFromTemplate(config.providers[item.provider].update_check_url, item)
	let result = (await (await fetch(url)).json());
	config.providers[item.provider].update_check_query.split('.').forEach((x: string | number) =>
	{
		if(typeof(x) == 'string' && x.startsWith('-'))
		{
			result = result[result.length - Number(x.slice(1))];
		}
		else
		{
			result = result[x];
		}
	});
	return result;
}

async function DownloadFile(url: string, destination: string)
{
	await download(url, {dir: path.dirname(destination), file: path.basename(destination)})
	.catch(err =>
	{
		console.log(`[${path.basename}]    ${err}`);
	});
}

async function CheckUpdate(config: any, pot: any)
{
	for(const item of config.use_latest)
	{
		console.log(`Checking ${item.name} from ${item.provider}`);

		if(!config.providers[item.provider])
		{
			throw(`${item.provider} is not defined in providers list`);
		}
		else
		{
			if(!config.providers[item.provider].update_check_url)
			{
				throw(`update_check_url is not defined in provider: ${item.provider}`);
			}
			else
			{
				const latest = await GetLatestVersion(config, item);
				const local = await GetLocalVersion(config, pot, item.name);

				const latestVersion = typeof(latest) == 'string' ? latest.split('.') : latest;
				const localVersion = typeof(local) == 'string' ? local.split('.') : local;

				if(latestVersion > localVersion)
				{
					item['VERSION'] = latest;
					await DownloadFile(CreateUrlFromTemplate(config.providers[item.provider].download_url, item),
						path.resolve(path.join(config.root_directory, item.relative_directory, `${item.name}.jar`)));
					pot[(item.name).toLowerCase()].version = latest
					console.log(`    Updated ${local} -> ${latest}`);
				}
				else
				{
					console.log(`    ${local} is latest`);
				}
			}
		}
	}
}

await new Command()
	.name("fern")
	.version("0.1")
	.description("MeaaC (Minecraft environment as a Code) utility tool.")
	.option('-c, --config-location <Directory:string>', 'Specify config location', {default: './', global: true})
	.option('-p, --profile-name <Name:string>', 'Specify profile name', {default: 'fern', global: true})

	.command('update', 'Update environment to latest.')
	.action(async (options: {[options: string]: string | number | boolean}, _args: string[]) =>
	{
		console.log(color.bold(color.green('Starting update...')));
		const config = JSON.parse(await Deno.readTextFile(path.resolve(path.join(`${options.configLocation}`, `${options.profileName}.json`))));
		const pot = JSON.parse(await Deno.readTextFile(path.resolve(path.join(`${options.configLocation}`, `${options.profileName}-pot.json`))));

		await CheckUpdate(config, pot);
		await Deno.writeTextFile(path.resolve(path.join(`${options.configLocation}`, `${options.profileName}-pot.json`)), JSON.stringify(pot));
	})

	.reset()
	.parse(Deno.args);
