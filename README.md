# Fern 🌿

Fern is MeaaC (Minecraft environment as a Code) utility tool.\
This tool can be used for manage / update / deploy Minecraft environment.

## Usage

### Initilize

```bash
$ fern init [-p | --profile-name] [ProfileName]
```

This command will generate a `fern.json` and `fern-pot.json` file in current
directory.\
If you want to use a profile name, you can use `-p` or `--profile-name` option.
(will generate `ProfileName.json` and `ProfileName-pot.json`)

### Configure Profile

```bash
$ nano fern.json
```

### Update Environment

```bash
$ fern update [-p | --profile-name] [ProfileName]
```

This command will update the environment using `fern.json` and `fern.json`
file.\
If you want to use a profile name, you can use `-p` or `--profile-name` option.

### Moving to another server

Copy `fern.json` and `fern-pot.json` to another server.\
Then you can use `fern update` command to update / deploy the environment.
