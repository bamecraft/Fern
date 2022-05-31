type Config = {
  config_version: number;
  root_directory: string;
  update_pre_script?: string;
  update_post_script?: string;
  providers: Providers;
  use_latest: UseLatest[];
};

type Providers = {
  [x: string]: {
    update_check_url?: string;
    update_check_query?: string;
    skip_update_check?: boolean;
    download_url: string;
  };
};

type UseLatest = {
  name: string;
  comment?: string;
  provider: string;
  relative_directory: string;
  pre_script?: string;
  post_script?: string;
} & {
  [x: string]: { [x: string]: string | number | boolean };
};

type Pot = [{
  pot_version: number;
}] & [{
  [x: string]: { version: string | number; [x: string]: string | number }[];
}];
